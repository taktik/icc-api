"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const _ = require("lodash")
const models = require("../icc-api/model/models")
class IccInvoiceXApi extends iccApi_1.iccInvoiceApi {
  constructor(
    host,
    headers,
    crypto,
    entityrefApi,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.entityrefApi = entityrefApi
  }
  newInstance(user, patient, inv) {
    const invoice = new models.InvoiceDto(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          groupId: this.crypto.randomUuid(),
          _type: "org.taktik.icure.entities.Invoice",
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: user.healthcarePartyId || user.patientId,
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
  initDelegationsAndEncryptionKeys(user, patient, invoice) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            invoice,
            patient,
            hcpId,
            secretForeignKeys.extractedKeys[0]
          ),
          this.crypto.initEncryptionKeys(invoice, hcpId)
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
                  hcpId,
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
  initEncryptionKeys(user, invoice) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(invoice, hcpId).then(eks => {
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
              .appendEncryptionKeys(invoice, hcpId, delegateId, eks.secretId)
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
  createInvoice(invoice, prefix) {
    if (!prefix) {
      return super.createInvoice(invoice)
    }
    if (!invoice.id) {
      invoice.id = this.crypto.randomUuid()
    }
    return this.getNextInvoiceReference(prefix, this.entityrefApi)
      .then(reference =>
        this.createInvoiceReference(reference, invoice.id, prefix, this.entityrefApi)
      )
      .then(entityReference => {
        if (!entityReference.id) {
          throw new Error("Cannot create invoice")
        }
        invoice.invoiceReference = entityReference.id.substr(prefix.length)
        return super.createInvoice(invoice)
      })
  }
  getNextInvoiceReference(prefix, entityrefApi) {
    return entityrefApi.getLatest(prefix).then(entRef => {
      if (!entRef || !entRef.id || !entRef.id.startsWith(prefix)) return 1
      const sequenceNumber = entRef.id.split(":").pop() || 0
      return Number(sequenceNumber) + 1
    })
  }
  createInvoiceReference(nextReference, docId, prefix, entityrefApi) {
    return entityrefApi
      .createEntityReference(
        new models.EntityReference({
          id: prefix + nextReference.toString().padStart(6, "0"),
          docId
        })
      )
      .catch(err => {
        console.log(err)
        return this.createInvoiceReference(nextReference + 1, docId, prefix, entityrefApi)
      })
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
  findBy(hcpartyId, patient) {
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
  encrypt(user, invoices) {
    return Promise.resolve(invoices)
  }
  decrypt(hcpartyId, invoices) {
    return Promise.resolve(invoices)
  }
}
exports.IccInvoiceXApi = IccInvoiceXApi
//# sourceMappingURL=icc-invoice-x-api.js.map
