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
  private docXApi: IccDocumentXApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    receiptApi: iccReceiptApi,
    invoiceApi: iccInvoiceApi,
    docXApi: IccDocumentXApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptApi = receiptApi
    this.invoiceApi = invoiceApi
    this.docXApi = docXApi
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

          const totalAmount = invoices
            .reduce((acc, invoice) => {
              return (
                acc +
                invoice.invoiceDto.invoicingCodes.reduce((accCode, code) => {
                  return accCode + code.patientIntervention + code.reimbursement
                }, 0)
              )
            }, 0)
            .toString()

          const invoicingDate = toMoment(invoices[0].invoiceDto.invoiceDate).format("MM/YYYY")

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
            recipientsType: "org.taktik.icure.entities.Insurance",
            metas: {
              totalAmount,
              invoicingDate
            }
          })
        })
        .then(message =>
          toInvoiceBatch(
            invoices,
            hcp,
            smallBase36,
            message.externalRef!!,
            fullBase36,
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
                    this.docXApi.newInstance(user, msg, { mainUti: "public.text", name: "920000" })
                  )
                  .then(doc => this.docXApi.createDocument(doc))
                  .then(doc =>
                    this.docXApi.setAttachment(
                      doc.id!!,
                      undefined /*TODO provide keys for encryption*/,
                      utils.ua2ArrayBuffer(utils.text2ua(res.detail!!))
                    )
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
