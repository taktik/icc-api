import {
  iccEntityrefApi,
  iccInsuranceApi,
  iccMessageApi,
  iccReceiptApi,
  iccInvoiceApi
} from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { EntityReference, HealthcarePartyDto, ReceiptDto, UserDto } from "../icc-api/model/models"
import {
  InvoiceWithPatient,
  toInvoiceBatch,
  getFederaton,
  uuidBase36,
  uuidBase36Half
} from "./utils/efact-util"
import { timeEncode, dateDecode, toMoment } from "./utils/formatting-util"
import { fhcEfactcontrollerApi } from "fhc-api"
import { EfactSendResponse } from "fhc-api/dist/model/EfactSendResponse"
import { utils } from "./crypto/utils"

export class IccMessageXApi extends iccMessageApi {
  private crypto: IccCryptoXApi
  private insuranceApi: iccInsuranceApi
  private entityReferenceApi: iccEntityrefApi
  private receiptApi: iccReceiptApi
  private invoiceApi: iccInvoiceApi
  private documentXApi: IccDocumentXApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    receiptApi: iccReceiptApi,
    invoiceApi: iccInvoiceApi,
    documentXApi: IccDocumentXApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptApi = receiptApi
    this.invoiceApi = invoiceApi
    this.documentXApi = documentXApi
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

  sendBatch(
    user: UserDto,
    hcp: HealthcarePartyDto,
    invoices: Array<InvoiceWithPatient>,
    xFHCKeystoreId: string,
    xFHCTokenId: string,
    xFHCPassPhrase: string,
    efactApi: fhcEfactcontrollerApi
  ): Promise<models.MessageDto> {
    const uuid = this.crypto.randomUuid()
    const smallBase36 = uuidBase36Half(uuid)
    const fullBase36 = uuidBase36(uuid)
    const sentDate = +new Date()
    const errors: Array<string> = []
    let batch: any = null

    return getFederaton(invoices, this.insuranceApi).then(fed => {
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
            recipients: [fed.id],
            recipientsType: "org.taktik.icure.entities.Insurance"
          })
        })
        .then(message =>
          // Fullbase36 and smallBase36 => inversé
          toInvoiceBatch(
            invoices,
            hcp,
            fullBase36,
            message.externalRef!!,
            smallBase36,
            this.insuranceApi
          )
            .then(_batch => {
              batch = _batch
              console.log("batch", batch)
              return efactApi.sendBatchUsingPOST(xFHCKeystoreId, xFHCTokenId, xFHCPassPhrase, batch)
            })
            .then((res: EfactSendResponse) => {
              if (res.success) {
                let promise = Promise.resolve(true)
                let totalAmount = 0
                _.forEach(invoices, iv => {
                  promise = promise.then(() => {
                    _.forEach(iv.invoiceDto.invoicingCodes, code => {
                      code.status = 4 // STATUS_PENDING
                      totalAmount += code.reimbursement || 0
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
                        status: (message.status || 0) | (1 << 8),
                        metas: {
                          ioFederationCode: batch.ioFederationCode,
                          numericalRef: batch.numericalRef,
                          invoiceMonth: batch.invoicingMonth,
                          invoiceYear: batch.invoicingYear,
                          totalAmount: totalAmount
                        }
                      })
                    )
                  )
                  .then(msg =>
                    Promise.all([
                      this.documentXApi.newInstance(user, msg, {
                        mainUti: "public.plain-text",
                        name: "920000"
                      }),
                      this.documentXApi.newInstance(user, msg, {
                        mainUti: "public.json",
                        name: "920000_records"
                      })
                    ])
                  )
                  .then(([doc, jsonDoc]) =>
                    Promise.all([
                      this.documentXApi.createDocument(doc),
                      this.documentXApi.createDocument(jsonDoc)
                    ])
                  )
                  .then(([doc, jsonDoc]) =>
                    Promise.all([
                      this.documentXApi.setAttachment(
                        doc.id!!,
                        undefined /*TODO provide keys for encryption*/,
                        utils.ua2ArrayBuffer(utils.text2ua(res.detail!!))
                      ),
                      this.documentXApi.setAttachment(
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
          console.log(err)
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
