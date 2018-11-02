import {
  iccEntityrefApi,
  iccInsuranceApi,
  iccMessageApi,
  iccReceiptApi,
  iccInvoiceApi
} from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"
import { IccInvoiceXApi } from "./icc-invoice-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import {
  EntityReference,
  HealthcarePartyDto,
  InvoiceDto,
  ListOfIdsDto,
  MessageDto,
  ReceiptDto,
  UserDto
} from "../icc-api/model/models"
import {
  InvoiceWithPatient,
  toInvoiceBatch,
  decodeBase36Uuid,
  uuidBase36,
  uuidBase36Half,
  getFederaton
} from "./utils/efact-util"
import { timeEncode } from "./utils/formatting-util"
import { fhcEfactcontrollerApi } from "fhc-api"
import { EfactSendResponse } from "fhc-api/dist/model/EfactSendResponse"
import { utils } from "./crypto/utils"
import { EfactMessage } from "fhc-api/dist/model/EfactMessage"
import {
  EfactMessage920098Reader,
  EfactMessage920099Reader,
  EfactMessage920900Reader,
  EfactMessage920999Reader,
  EfactMessage931000Reader,
  EfactMessageReader,
  File920900Data,
  ET91Data,
  ET92Data,
  ET20_80Data
} from "./utils/efact-parser"
import { ErrorDetail } from "fhc-api/dist/model/ErrorDetail"

interface StructError {
  itemId: string | null
  error: ErrorDetail
  record: string
}
export class IccMessageXApi extends iccMessageApi {
  private crypto: IccCryptoXApi
  private insuranceApi: iccInsuranceApi
  private entityReferenceApi: iccEntityrefApi
  private receiptApi: iccReceiptApi
  private invoiceApi: iccInvoiceApi
  private invoiceXApi: IccInvoiceXApi
  private documentXApi: IccDocumentXApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    receiptApi: iccReceiptApi,
    invoiceApi: iccInvoiceApi,
    invoiceXApi: IccInvoiceXApi,
    documentXApi: IccDocumentXApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptApi = receiptApi
    this.invoiceApi = invoiceApi
    this.documentXApi = documentXApi
    this.invoiceXApi = invoiceXApi
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

  extractErrorMessage(error?: ErrorDetail): string | undefined {
    if (!error) return

    const code1 = Number(error.rejectionCode1)
    const code2 = Number(error.rejectionCode2)
    const code3 = Number(error.rejectionCode3)
    const desc1 = (error.rejectionDescr1 && error.rejectionDescr1.trim()) || ""
    const desc2 = (error.rejectionDescr2 && error.rejectionDescr2.trim()) || ""
    const desc3 = (error.rejectionDescr3 && error.rejectionDescr3.trim()) || ""

    return code1 || code2 || code3 || desc1 || desc2 || desc3
      ? _.compact([
          code1 || desc1.length ? `${code1 || "XXXXXX"}: ${desc1 || " — "}` : null,
          code2 || desc2.length ? `${code2 || "XXXXXX"}: ${desc2 || " — "}` : null,
          code3 || desc3.length ? `${code3 || "XXXXXX"}: ${desc3 || " — "}` : null
        ]).join("; ")
      : undefined
  }

  extractErrors(parsedRecords: any): string[] {
    const errors: ErrorDetail[] = (parsedRecords.et10 && parsedRecords.et10.errorDetail
      ? [parsedRecords.et10.errorDetail]
      : []
    )
      .concat(
        _.flatMap(parsedRecords.records as ET20_80Data[], r => {
          const errors: Array<ErrorDetail> = []

          if (r.et20 && r.et20.errorDetail) {
            errors.push(r.et20.errorDetail)
          }
          _.each(r.items, i => {
            if (i.et50 && i.et50.errorDetail) errors.push(i.et50.errorDetail)
            if (i.et51 && i.et51.errorDetail) errors.push(i.et51.errorDetail)
            if (i.et52 && i.et52.errorDetail) errors.push(i.et52.errorDetail)
          })
          if (r.et80 && r.et80.errorDetail) {
            errors.push(r.et80.errorDetail)
          }
          return errors
        })
      )
      .concat(
        parsedRecords.et90 && parsedRecords.et90.errorDetail ? [parsedRecords.et90.errorDetail] : []
      )

    const errorMessages = _.compact(_.map(errors, error => this.extractErrorMessage(error)))

    return errorMessages
  }

  processTack(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage
  ): Promise<ReceiptDto> {
    if (!efactMessage.tack) {
      return Promise.reject(new Error("Invalid tack"))
    }

    const refStr = _.get(efactMessage, "tack.appliesTo", "")
      .split(":")
      .pop()
    if (!refStr) {
      return Promise.reject(
        new Error(`Cannot find onput reference from tack: ${_.get(efactMessage, "tack.appliesTo")}`)
      )
    }
    const ref = Number(refStr!!) % 10000000000

    return this.findMessagesByTransportGuid(
      "EFACT:BATCH:" + ref,
      false,
      undefined,
      undefined,
      100
    ).then(parents => {
      const msgsForHcp = ((parents && parents.rows) || []).filter(
        (p: MessageDto) => p.responsible === hcp.id
      )
      if (!msgsForHcp.length) {
        throw new Error(`Cannot find parent with ref ${ref}`)
      }
      const parentMessage: MessageDto = msgsForHcp[0]

      return this.receiptApi
        .createReceipt(
          new ReceiptDto({
            documentId: parentMessage.id,
            references: [
              `mycarenet:efact:inputReference:${ref}`,
              efactMessage.tack!!.appliesTo,
              efactMessage.tack!!.reference
            ]
          })
        )
        .then(rcpt =>
          this.receiptApi.setAttachment(rcpt.id, "tack", undefined, <any>(
            utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(efactMessage.tack)))
          ))
        )
        .then(() => {
          parentMessage.status = parentMessage.status!! | (1 << 8) /*STATUS_SUBMITTED*/
          return this.modifyMessage(parentMessage)
        })
    })
  }

  // Pass invoicePrefix if you want to generate the invoice reference from entityRef
  processEfactMessage(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage,
    invoicePrefix?: string
  ): Promise<MessageDto> {
    const ref = Number(efactMessage.commonOutput!!.inputReference!!) % 10000000000

    return this.findMessagesByTransportGuid(
      "EFACT:BATCH:" + ref,
      false,
      undefined,
      undefined,
      100
    ).then(parents => {
      const msgsForHcp = ((parents && parents.rows) || []).filter(
        (p: MessageDto) => p.responsible === hcp.id
      )
      if (!msgsForHcp.length) {
        throw new Error(`Cannot find parent with ref ${ref}`)
      }
      const parentMessage: MessageDto = msgsForHcp[0]

      const messageType = efactMessage.detail!!.substr(0, 6)
      const parser: EfactMessageReader | null =
        messageType === "920098"
          ? new EfactMessage920098Reader(efactMessage)
          : messageType === "920099"
            ? new EfactMessage920099Reader(efactMessage)
            : messageType === "920900"
              ? new EfactMessage920900Reader(efactMessage)
              : messageType === "920999"
                ? new EfactMessage920999Reader(efactMessage)
                : messageType === "931000"
                  ? new EfactMessage931000Reader(efactMessage)
                  : null

      if (!parser) {
        throw Error(`Unsupported message type ${messageType}`)
      }

      const parsedRecords = parser.read()

      if (!parsedRecords) {
        throw new Error("Cannot parse...")
      }

      const errors = this.extractErrors(parsedRecords)

      const statuses =
        (["920999", "920099"].includes(messageType) ? 1 << 17 /*STATUS_ERROR*/ : 0) |
        (["920900", "920098"].includes(messageType) && errors.length
          ? 1 << 16 /*STATUS_WARNING*/
          : 0) |
        (["920900"].includes(messageType) && !errors.length ? 1 << 15 /*STATUS_SUCCESS*/ : 0) |
        (["920999"].includes(messageType) ? 1 << 12 /*STATUS_REJECTED*/ : 0) |
        (["920900", "920098", "920099"].includes(messageType) ? 1 << 11 /*STATUS_ACCEPTED*/ : 0) |
        (["931000"].includes(messageType) ? 1 << 10 /*STATUS_ACCEPTED_FOR_TREATMENT*/ : 0) |
        (["931000", "920999"].includes(messageType) ? 1 << 9 /*STATUS_RECEIVED*/ : 0)

      const batchErrors: ErrorDetail[] | undefined = _.compact([
        _.get(parsedRecords, "records.zone200.errorDetail"),
        _.get(parsedRecords, "records.zone300.errorDetail"),
        _.get(parsedRecords, "records.et10.errorDetail")
      ])

      const invoicingErrors: StructError[] = parsedRecords.records
        ? _.compact(
            _.flatMap(parsedRecords.records as ET20_80Data[], r => {
              const errors: StructError[] = []
              if (r.et20 && r.et20.errorDetail)
                errors.push({
                  itemId: decodeBase36Uuid(r.et20.reference.trim()),
                  error: r.et20.errorDetail,
                  record: "ET20"
                })
              _.each(r.items, i => {
                let ref = _.get(i, "et50.itemReference") || _.get(r, "et20.reference")
                if (i.et50 && i.et50.errorDetail)
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref.trim()),
                    error: i.et50.errorDetail,
                    record: "ET50"
                  })
                if (i.et51 && i.et51.errorDetail)
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref.trim()),
                    error: i.et51.errorDetail,
                    record: "ET51"
                  })
                if (i.et52 && i.et52.errorDetail)
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref.trim()),
                    error: i.et52.errorDetail,
                    record: "ET52"
                  })
              })
              return errors
            })
          )
        : []

      return this.newInstance(user, {
        // tslint:disable-next-line:no-bitwise
        status: (1 << 1) /*STATUS_UNREAD*/ | statuses,
        transportGuid: "EFACT:IN:" + ref,
        fromAddress: "EFACT",
        sent: timeEncode(new Date()),
        fromHealthcarePartyId: hcp.id,
        recipients: [hcp.id],
        recipientsType: "org.taktik.icure.entities.HealthcareParty",
        received: +new Date(),
        subject: messageType,
        parentId: parentMessage.id,
        senderReferences: {
          inputReference: efactMessage.commonOutput!!.inputReference,
          outputReference: efactMessage.commonOutput!!.outputReference,
          nipReference: efactMessage.commonOutput!!.nipReference
        }
      })
        .then(msg => this.createMessage(msg))
        .then(msg =>
          Promise.all([
            this.documentXApi.newInstance(user, msg, {
              mainUti: "public.plain-text",
              name: msg.subject
            }),
            this.documentXApi.newInstance(user, msg, {
              mainUti: "public.json",
              name: `${msg.subject}_records`
            }),
            this.documentXApi.newInstance(user, msg, {
              mainUti: "public.json",
              name: `${msg.subject}_parsed_records`
            })
          ])
            .then(([doc, jsonDoc, jsonParsedDoc]) =>
              Promise.all([
                this.documentXApi.createDocument(doc),
                this.documentXApi.createDocument(jsonDoc),
                this.documentXApi.createDocument(jsonParsedDoc)
              ])
            )
            .then(([doc, jsonDoc, jsonParsedDoc]) =>
              Promise.all([
                this.documentXApi.setAttachment(
                  doc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  <any>utils.ua2ArrayBuffer(utils.text2ua(efactMessage.detail!!))
                ),
                this.documentXApi.setAttachment(
                  jsonDoc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(efactMessage)))
                ),
                this.documentXApi.setAttachment(
                  jsonParsedDoc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(parsedRecords)))
                )
              ])
            )
            .then(
              () =>
                ["920999", "920099", "920900"].includes(messageType)
                  ? this.invoiceApi.getInvoices(new ListOfIdsDto({ ids: parentMessage.invoiceIds }))
                  : Promise.resolve([])
            )
            .then((invoices: Array<models.InvoiceDto>) => {
              // RejectAll if "920999", "920099"
              const rejectAll = (statuses & (1 << 17)) /*STATUS_ERROR*/ > 0

              return Promise.all(
                _.flatMap(invoices, iv => {
                  iv.error =
                    _(invoicingErrors)
                      .filter(it => it.itemId === iv.id)
                      .map(e => this.extractErrorMessage(e.error))
                      .compact()
                      .join("; ") || undefined

                  let newInvoice: InvoiceDto | null = null
                  _.each(iv.invoicingCodes, ic => {
                    // If the invoicing code is already treated, do not treat it
                    if (ic.canceled || ic.accepted) {
                      return
                    }

                    // Error from the ET50/51/52 linked to the invoicingCode
                    const errStruct = invoicingErrors.filter(it => it.itemId === ic.id)

                    if (rejectAll || errStruct.length) {
                      ic.logicalId = ic.logicalId || this.crypto.randomUuid()
                      ic.accepted = false
                      ic.canceled = true
                      ic.pending = false
                      ic.resent = false
                      ic.error =
                        _(errStruct)
                          .map(e => this.extractErrorMessage(e.error))
                          .compact()
                          .join("; ") || undefined
                      ;(
                        newInvoice ||
                        (newInvoice = new InvoiceDto(
                          _.pick(iv, [
                            "invoiceDate",
                            "recipientType",
                            "recipientId",
                            "invoiceType",
                            "secretForeignKeys",
                            "cryptedForeignKeys",
                            "delegations",
                            "encryptionKeys",
                            "paid",
                            "author",
                            "responsible",
                            //
                            "groupId",
                            "sentMediumType",
                            "interventionType",
                            //
                            "gnotionNihii",
                            "gnotionSsin",
                            "gnotionLastName",
                            "gnotionFirstName",
                            "gnotionCdHcParty",
                            //
                            "internshipNihii",
                            "internshipSsin",
                            "internshipLastName",
                            "internshipFirstName",
                            "internshipCdHcParty"
                          ])
                        ))
                      ).invoicingCodes = (newInvoice.invoicingCodes || []).concat(
                        _.assign({}, ic, {
                          id: this.crypto.randomUuid(),
                          logicalId: ic.logicalId,
                          accepted: false,
                          canceled: false,
                          pending: true,
                          resent: true
                        })
                      )
                    } else {
                      ic.accepted = true
                      ic.canceled = false
                      ic.pending = false
                      ic.resent = false
                      ic.error = undefined

                      let record51 =
                        messageType === "920900" &&
                        _.compact(
                          _.flatMap((parsedRecords as File920900Data).records, r =>
                            r.items!!.map(
                              i =>
                                i &&
                                i.et50 &&
                                decodeBase36Uuid(i.et50.itemReference) === ic.id &&
                                i.et51
                            )
                          )
                        )[0]
                      ic.paid =
                        (record51 &&
                          record51.reimbursementAmount &&
                          Number((Number(record51.reimbursementAmount) / 100).toFixed(2))) ||
                        ic.reimbursement
                    }
                  })

                  return newInvoice
                    ? [
                        this.invoiceXApi.createInvoice(newInvoice, invoicePrefix),
                        this.invoiceApi.modifyInvoice(iv)
                      ]
                    : [this.invoiceApi.modifyInvoice(iv)]
                })
              )
            })
            .then(() => {
              parentMessage.status = (parentMessage.status || 0) | statuses

              if (batchErrors.length) {
                parentMessage.metas = _.assign(parentMessage.metas || {}, {
                  errors: _(batchErrors)
                    .map(this.extractErrorMessage)
                    .compact()
                    .join("; ")
                })
              }
              if (parsedRecords.et91) {
                let et91s = parsedRecords.et91 as Array<ET91Data>
                parentMessage.metas = _.assign(parentMessage.metas || {}, {
                  paymentReferenceAccount1: _(et91s)
                    .map(et91 => et91.paymentReferenceAccount1)
                    .uniq()
                    .join(", ")
                })
              }
              if (parsedRecords.et92) {
                let et92 = parsedRecords.et92 as ET92Data
                parentMessage.metas = _.assign(parentMessage.metas || {}, {
                  totalAskedAmount: Number(et92.totalAskedAmount) / 100,
                  totalAcceptedAmount: Number(et92.totalAcceptedAmount) / 100,
                  totalRejectedAmount: Number(et92.totalRejectedAmount) / 100
                })
              }
              return this.modifyMessage(parentMessage)
            })
        )
    })
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
        .then(er =>
          toInvoiceBatch(
            invoices,
            hcp,
            fullBase36,
            er && er.id ? Number(er.id.substr(prefix.length)) % 1000 : 0,
            smallBase36,
            this.insuranceApi
          )
        )
        .then(batch =>
          efactApi
            .sendBatchUsingPOST(xFHCKeystoreId, xFHCTokenId, xFHCPassPhrase, batch)
            .then((res: EfactSendResponse) => {
              if (res.success) {
                let promise = Promise.resolve(true)
                let totalAmount = 0
                _.forEach(invoices, iv => {
                  promise = promise.then(() => {
                    _.forEach(iv.invoiceDto.invoicingCodes, code => {
                      code.pending = true // STATUS_PENDING
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
                    this.newInstance(user, {
                      id: uuid,
                      invoiceIds: invoices.map(i => i.invoiceDto.id),
                      // tslint:disable-next-line:no-bitwise
                      status: 1 << 6, // STATUS_EFACT
                      externalRef: "" + batch.uniqueSendNumber,
                      transportGuid: "EFACT:BATCH:" + batch.numericalRef,
                      sent: timeEncode(new Date()),
                      fromHealthcarePartyId: hcp.id,
                      recipients: [fed.code],
                      recipientsType: "org.taktik.icure.entities.Insurance"
                    })
                  )
                  .then(message =>
                    this.createMessage(
                      Object.assign(message, {
                        sent: sentDate,
                        status: (message.status || 0) | (1 << 7) /*STATUS_SENT*/,
                        metas: {
                          ioFederationCode: batch.ioFederationCode,
                          numericalRef: batch.numericalRef,
                          invoiceMonth: batch.invoicingMonth,
                          invoiceYear: batch.invoicingYear,
                          totalAmount: totalAmount
                        }
                      })
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
                            <any>utils.ua2ArrayBuffer(utils.text2ua(res.detail!!))
                          ),
                          this.documentXApi.setAttachment(
                            jsonDoc.id!!,
                            undefined /*TODO provide keys for encryption*/,
                            <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.records!!)))
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
                      .then(rcpt =>
                        this.receiptApi.setAttachment(rcpt.id, "tack", undefined, <any>(
                          utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.tack)))
                        ))
                      )
                      .then(() => message)
                  )
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
