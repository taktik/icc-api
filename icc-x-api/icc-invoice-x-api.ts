import { iccInvoiceApi, iccEntityrefApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import { XHR } from "../icc-api/api/XHR"
import { InvoiceDto } from "../icc-api/model/models"

export class IccInvoiceXApi extends iccInvoiceApi {
  crypto: IccCryptoXApi
  entityrefApi: iccEntityrefApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    entityrefApi: iccEntityrefApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.entityrefApi = entityrefApi
  }

  newInstance(
    user: models.UserDto,
    patient: models.PatientDto,
    inv?: any
  ): Promise<models.InvoiceDto> {
    const invoice = new models.InvoiceDto(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          groupId: this.crypto.randomUuid(),
          _type: "org.taktik.icure.entities.Invoice",
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: user.healthcarePartyId,
          author: user.id,
          codes: [],
          tags: [],
          invoicingCodes: []
        },
        inv || {}
      )
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, invoice)
  }

  private initDelegationsAndEncryptionKeys(
    user: models.UserDto,
    patient: models.PatientDto,
    invoice: models.InvoiceDto
  ): Promise<models.InvoiceDto> {
    return this.crypto
      .extractDelegationsSFKs(patient, user.healthcarePartyId!)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            invoice,
            patient,
            user.healthcarePartyId!,
            secretForeignKeys.extractedKeys[0]
          ),
          this.crypto.initEncryptionKeys(invoice, user.healthcarePartyId!)
        ])
      )
      .then(initData => {
        const dels = initData[0]
        const eks = initData[1]
        _.extend(invoice, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys
        })

        let promise = Promise.resolve(invoice)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.financialInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(invoice =>
              this.crypto
                .addDelegationsAndEncryptionKeys(
                  patient,
                  invoice,
                  user.healthcarePartyId!,
                  delegateId,
                  dels.secretId,
                  eks.secretId
                )
                .catch(e => {
                  console.log(e)
                  return invoice
                })
            ))
        )
        return promise
      })
  }

  initEncryptionKeys(user: models.UserDto, invoice: models.InvoiceDto) {
    return this.crypto.initEncryptionKeys(invoice, user.healthcarePartyId!).then(eks => {
      let promise = Promise.resolve(
        _.extend(invoice, {
          encryptionKeys: eks.encryptionKeys
        })
      )
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.financialInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(invoice =>
            this.crypto
              .appendEncryptionKeys(invoice, user.healthcarePartyId!, delegateId, eks.secretId)
              .then(extraEks => {
                return _.extend(invoice, {
                  encryptionKeys: extraEks.encryptionKeys
                })
              })
          ))
      )
      return promise
    })
  }

  createInvoice(invoice: InvoiceDto, prefix?: string): Promise<InvoiceDto> {
    if (!prefix) {
      return super.createInvoice(invoice)
    }
    return this.getNextInvoiceReference(prefix, this.entityrefApi).then(reference => {
      invoice.invoiceReference = reference.toString().padStart(6, "0")
      return super.createInvoice(invoice).then(newInvoiceCreated => {
        return this.createInvoiceReference(
          reference,
          newInvoiceCreated.id,
          prefix,
          this.entityrefApi
        ).then(() => {
          return newInvoiceCreated
        })
      })
    })
  }

  getNextInvoiceReference(prefix: string, entityrefApi: iccEntityrefApi): Promise<number> {
    return entityrefApi.getLatest(prefix).then((entRef: models.EntityReference) => {
      if (!entRef || !entRef.id || !entRef.id!.startsWith(prefix)) return 1
      const sequenceNumber = entRef.id!.split(":").pop() || 0
      return Number(sequenceNumber) + 1
    })
  }

  createInvoiceReference(
    nextReference: number,
    docId: string,
    prefix: string,
    entityrefApi: iccEntityrefApi
  ): Promise<models.EntityReference> {
    return entityrefApi.createEntityReference(
      new models.EntityReference({
        id: prefix + nextReference.toString().padStart(6, "0"),
        docId
      })
    )
  }

  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all invoices with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the invoices of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   */
  findBy(hcpartyId: string, patient: models.PatientDto): Promise<Array<models.InvoiceDto>> {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then(secretForeignKeys =>
        this.findByHCPartyPatientSecretFKeys(
          secretForeignKeys.hcpartyId,
          secretForeignKeys.extractedKeys.join(",")
        )
      )
      .then(invoices => this.decrypt(hcpartyId, invoices))
      .then(function(decryptedInvoices) {
        return decryptedInvoices
      })
  }

  encrypt(user: models.UserDto, invoices: Array<models.InvoiceDto>) {
    return Promise.resolve(invoices)
  }

  decrypt(
    hcpartyId: string,
    invoices: Array<models.InvoiceDto>
  ): Promise<Array<models.InvoiceDto>> {
    return Promise.resolve(invoices)
  }
}
