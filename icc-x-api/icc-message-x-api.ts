import {
  iccEntityrefApi,
  iccInsuranceApi,
  iccMessageApi,
  iccReceiptApi,
  iccInvoiceApi
} from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { EntityReference, HealthcarePartyDto, ReceiptDto, UserDto } from "../icc-api/model/models"
import { InvoiceWithPatient, toInvoiceBatch, uuidBase36, uuidBase36Half } from "./utils/efact-util"
import { timeEncode } from "./utils/formatting-util"
import { fhcEfactcontrollerApi } from "fhc-api"
import { EfactSendResponse } from "fhc-api/dist/model/EfactSendResponse"
import { IccDocumentXApi } from "./icc-document-x-api"
import { utils } from "./crypto/utils"
import { Record } from "fhc-api/dist/model/Record"
import { EfactMessage } from "fhc-api/dist/model/EfactMessage"
import { EfactMessageReader } from "./utils/efact-reader"

export class IccMessageXApi extends iccMessageApi {
  private crypto: IccCryptoXApi
  private insuranceApi: iccInsuranceApi
  private entityReferenceApi: iccEntityrefApi
  private receiptApi: iccReceiptApi
  private invoiceApi: iccInvoiceApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    receiptApi: iccReceiptApi,
    invoiceApi: iccInvoiceApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptApi = receiptApi
    this.invoiceApi = invoiceApi
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.UserDto, p: any) {
    const message = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Message",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      p || {}
    )
    return this.initDelegations(message, null, user)
  }

  processEfactMessage(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage,
    docXApi: IccDocumentXApi
  ) {
    const parsedRecords = new EfactMessageReader(efactMessage).read()
    const ref = efactMessage.commonOutput.inputReference
    this.newInstance(user, {
      // tslint:disable-next-line:no-bitwise
      status: 1 << 1, // STATUS_EFACT
      transportGuid: "EFACT:IN:" + ref,
      fromAddress: "EFACT",
      sent: timeEncode(new Date()),
      fromHealthcarePartyId: hcp.id,
      recipients: [hcp.id],
      recipientsType: "org.taktik.icure.entities.HealthcareParty",
      received: +new Date(),
      subject: efactMessage.detail!!.substr(0, 6)
    })
      .then(msg => this.createMessage(msg))
      .then(msg =>
        Promise.all([
          docXApi.newInstance(user, msg, {
            mainUti: "public.plain-text",
            name: msg.subject
          }),
          docXApi.newInstance(user, msg, {
            mainUti: "public.json",
            name: `${msg.subject}_records`
          })
        ])
      )
      .then(([doc, jsonDoc]) =>
        Promise.all([docXApi.createDocument(doc), docXApi.createDocument(jsonDoc)])
      )
      .then(([doc, jsonDoc]) =>
        Promise.all([
          docXApi.setAttachment(
            doc.id!!,
            undefined /*TODO provide keys for encryption*/,
            utils.ua2ArrayBuffer(utils.text2ua(efactMessage.detail!!))
          ),
          docXApi.setAttachment(
            jsonDoc.id!!,
            undefined /*TODO provide keys for encryption*/,
            utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(parsedRecords)))
          )
        ])
      )
  }

  sendBatch(
    user: UserDto,
    hcp: HealthcarePartyDto,
    federationId: string, //uuid for the Insurance
    invoices: Array<InvoiceWithPatient>,
    xFHCKeystoreId: string,
    xFHCTokenId: string,
    xFHCPassPhrase: string,
    efactApi: fhcEfactcontrollerApi,
    docXApi: IccDocumentXApi
  ): Promise<models.MessageDto> {
    const uuid = this.crypto.randomUuid()
    const smallBase36 = uuidBase36Half(uuid)
    const fullBase36 = uuidBase36(uuid)
    const sentDate = +new Date()
    const errors: Array<string> = []

    return this.insuranceApi.getInsurance(federationId).then(fed => {
      const prefix = `efact:${hcp.id}:${fed.code}:`
      return this.entityReferenceApi
        .getLatest(prefix)
        .then(er =>
          this.entityReferenceApi.createEntityReference(
            new EntityReference({
              id:
                prefix +
                _.padStart(
                  "" + (((er && er.id ? Number(er.id.substr(prefix.length)) : 0) + 1) % 1000000000),
                  9, //1 billion invoices that are going to be mod 1000
                  "0"
                ),
              docId: uuid
            })
          )
        )
        .then(er => {
          const sendNumber = er && er.id ? Number(er.id.substr(prefix.length)) % 1000 : 0
          return this.newInstance(user, {
            id: uuid,
            invoiceIds: invoices.map(i => i.invoiceDto.id),
            // tslint:disable-next-line:no-bitwise
            status: 1 << 6, // STATUS_EFACT
            externalRef: sendNumber,
            transportGuid: "EFACT:BATCH:" + smallBase36,
            sent: timeEncode(new Date()),
            fromHealthcarePartyId: hcp.id,
            recipients: [federationId],
            recipientsType: "org.taktik.icure.entities.Insurance"
          })
        })
        .then(message =>
          toInvoiceBatch(
            invoices,
            hcp,
            fullBase36,
            message.externalRef!!,
            smallBase36,
            this.insuranceApi
          )
            .then(batch =>
              efactApi.sendBatchUsingPOST(xFHCKeystoreId, xFHCTokenId, xFHCPassPhrase, batch)
            )
            .then((res: EfactSendResponse) => {
              if (res.success) {
                let promise = Promise.resolve(true)

                _.each(invoices, iv => {
                  promise = promise.then(() => {
                    ;(iv.invoiceDto.invoicingCodes || []).forEach(code => {
                      code.status = 4 // STATUS_PENDING
                    })
                    iv.invoiceDto.sentDate = sentDate
                    return this.invoiceApi.modifyInvoice(iv.invoiceDto).catch((err: any) => {
                      errors.push(`efac-management.CANNOT_UPDATE_INVOICE.${iv.invoiceDto.id}`)
                    })
                  })
                })
                return promise
                  .then(() =>
                    this.createMessage(
                      Object.assign(message, {
                        sent: sentDate,
                        status: (message.status || 0) | (1 << 8)
                      })
                    )
                  )
                  .then(msg =>
                    Promise.all([
                      docXApi.newInstance(user, msg, {
                        mainUti: "public.plain-text",
                        name: "920000"
                      }),
                      docXApi.newInstance(user, msg, {
                        mainUti: "public.json",
                        name: "920000_records"
                      })
                    ])
                  )
                  .then(([doc, jsonDoc]) =>
                    Promise.all([docXApi.createDocument(doc), docXApi.createDocument(jsonDoc)])
                  )
                  .then(([doc, jsonDoc]) =>
                    Promise.all([
                      docXApi.setAttachment(
                        doc.id!!,
                        undefined /*TODO provide keys for encryption*/,
                        utils.ua2ArrayBuffer(utils.text2ua(res.detail!!))
                      ),
                      docXApi.setAttachment(
                        jsonDoc.id!!,
                        undefined /*TODO provide keys for encryption*/,
                        utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.records!!)))
                      )
                    ])
                  )
                  .then(() =>
                    this.receiptApi.createReceipt(
                      new ReceiptDto({
                        documentId: message.id,
                        references: [
                          `mycarenet:efact:inputReference:${res.inputReference}`,
                          res.tack!!.appliesTo,
                          res.tack!!.reference
                        ]
                      })
                    )
                  )
                  .then(rcpt => {
                    this.receiptApi.setAttachment(
                      rcpt.id,
                      "tack",
                      undefined,
                      utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.tack)))
                    )
                  })
                  .then(() => message)
              } else {
                throw "Cannot send batch"
              }
            })
        )
        .catch(err => {
          errors.push(err)
          throw errors
        })
    })
  }

  initDelegations(
    message: models.MessageDto,
    parentObject: any,
    user: models.UserDto,
    secretForeignKey?: string
  ): Promise<models.MessageDto> {
    return this.crypto
      .initObjectDelegations(
        message,
        parentObject,
        user.healthcarePartyId!,
        secretForeignKey || null
      )
      .then(initData => {
        _.extend(message, { delegations: initData.delegations })

        let promise = Promise.resolve(message)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise
              .then(patient =>
                this.crypto.appendObjectDelegations(
                  message,
                  parentObject,
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
              )
              .then(extraData => _.extend(message, { delegations: extraData.delegations })))
        )
        return promise
      })
  }
}
