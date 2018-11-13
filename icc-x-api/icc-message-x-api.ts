import { iccEntityrefApi, iccInsuranceApi, iccMessageApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"
import { IccInvoiceXApi } from "./icc-invoice-x-api"

import * as _ from "lodash"
import moment from "moment"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import {
  EntityReference,
  Filter,
  FilterChain,
  HealthcarePartyDto,
  InvoiceDto,
  ListOfIdsDto,
  MessageDto,
  PatientHealthCarePartyDto,
  PatientPaginatedList,
  ReceiptDto,
  ReferralPeriod,
  UserDto
} from "../icc-api/model/models"
import {
  decodeBase36Uuid,
  InvoiceWithPatient,
  toInvoiceBatch,
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
import { IccReceiptXApi } from "./icc-receipt-x-api"
import { DmgsList } from "fhc-api/dist/model/DmgsList"
import { DmgClosure } from "fhc-api/dist/model/DmgClosure"
import { DmgExtension } from "fhc-api/dist/model/DmgExtension"
import { IccPatientXApi } from "./icc-patient-x-api"
import { HcpartyType } from "fhc-api/dist/model/HcpartyType"
import { IDHCPARTY } from "fhc-api/dist/model/IDHCPARTY"
import { GenAsyncResponse } from "fhc-api/dist/model/GenAsyncResponse"

interface StructError {
  itemId: string | null
  error: ErrorDetail
  record: string
}
export class IccMessageXApi extends iccMessageApi {
  private crypto: IccCryptoXApi
  private insuranceApi: iccInsuranceApi
  private entityReferenceApi: iccEntityrefApi
  private receiptXApi: IccReceiptXApi
  private invoiceXApi: IccInvoiceXApi
  private documentXApi: IccDocumentXApi
  private patientApi: IccPatientXApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    invoiceXApi: IccInvoiceXApi,
    documentXApi: IccDocumentXApi,
    receiptXApi: IccReceiptXApi,
    patientApi: IccPatientXApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptXApi = receiptXApi
    this.invoiceXApi = invoiceXApi
    this.documentXApi = documentXApi
    this.patientApi = patientApi
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

  saveDmgsListRequest(user: models.UserDto, req: GenAsyncResponse): Promise<MessageDto> {
    return this.newInstance(user, {
      // tslint:disable-next-line:no-bitwise
      transportGuid:
        "GMD:OUT:" +
        (
          (req.commonOutput && req.commonOutput.inputReference) ||
          req.tack!.appliesTo ||
          ""
        ).replace("urn:nip:reference:input:", ""),
      fromHealthcarePartyId: user.healthcarePartyId,
      sent: +new Date(),
      metas: { type: "listrequest" },
      subject: "Lists request",
      senderReferences: req.commonOutput
    })
      .then(msg => this.createMessage(msg))
      .then(msg => {
        return this.documentXApi
          .newInstance(user, msg, {
            mainUti: "public.json",
            name: `${msg.subject}_content.json`
          })
          .then(doc => this.documentXApi.createDocument(doc))
          .then(doc =>
            this.documentXApi.setAttachment(
              doc.id!!,
              undefined /*TODO provide keys for encryption*/,
              <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(req)))
            )
          )
          .then(() => msg)
      })
  }

  processDmgMessagesList(
    user: UserDto,
    hcp: HealthcarePartyDto,
    list: DmgsList,
    docXApi: IccDocumentXApi
  ): Promise<Array<Array<string>>> {
    const ackHashes: Array<string> = []
    let promAck: Promise<ReceiptDto | null> = Promise.resolve(null)
    _.each(list.acks, ack => {
      const ref = (ack.appliesTo || "").replace("urn:nip:reference:input:", "")
      promAck = promAck
        .then(() =>
          this.findMessagesByTransportGuid(`GMD:OUT:${ref}`, false, undefined, undefined, 100)
        )
        .then(parents => {
          const msgsForHcp = ((parents && parents.rows) || []).filter(
            (p: MessageDto) => p.responsible === hcp.id
          )
          if (!msgsForHcp.length) {
            throw new Error(`Cannot find parent with ref ${ref}`)
          }
          const parent: MessageDto = msgsForHcp[0]
          ;(parent.metas || (parent.metas = {}))[`tack.${ack.io}`] = (
            (ack.date && moment(ack.date)) ||
            moment()
          ).format("YYYYMMDDHHmmss")
          return this.modifyMessage(parent)
        })
        .catch(e => {
          console.log(e)
          return null
        })
        .then(() =>
          this.receiptXApi.logSCReceipt(ack, user, hcp.id!!, "dmg", "listAck", [
            `nip:pin:valuehash:${ack.valueHash}`
          ])
        )
        .then(receipt => {
          ack.valueHash && ackHashes.push(ack.valueHash)
          return receipt
        })
    })

    const patsDmgs: { [key: string]: any } = {}
    const msgHashes: Array<string> = []

    let promMsg: Promise<Array<MessageDto>> = promAck.then(() => [])
    _.each(list.lists, dmgsMsgList => {
      const metas = { type: "list" }
      _.each(dmgsMsgList.inscriptions, i => {
        i.inss &&
          (patsDmgs[i.inss] || (patsDmgs[i.inss] = [])).push({
            date: moment(i.from).format("DD/MM/YYYY"),
            from: moment(i.from).format("DD/MM/YYYY"),
            to: i.to,
            hcp: this.makeHcp(i.hcParty),
            payments: (i.payment1Amount
              ? [
                  {
                    amount: i.payment1Amount,
                    currency: i.payment1Currency,
                    date: i.payment1Date,
                    ref: i.payment1Ref
                  }
                ]
              : []
            ).concat(
              i.payment2Amount
                ? [
                    {
                      amount: i.payment2Amount,
                      currency: i.payment2Currency,
                      date: i.payment2Date,
                      ref: i.payment2Ref
                    }
                  ]
                : []
            )
          })
      })
      promMsg = promMsg.then(acc => {
        let ref = (dmgsMsgList.appliesTo || "").replace("urn:nip:reference:input:", "")
        return this.findMessagesByTransportGuid(
          `GMD:OUT:${ref}`,
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
          const parent: MessageDto = msgsForHcp[0]

          return this.saveMessageInDb(
            user,
            "List",
            dmgsMsgList,
            hcp,
            metas,
            docXApi,
            dmgsMsgList.date,
            undefined,
            parent && parent.id
          )
            .then(msg => {
              dmgsMsgList.valueHash && msgHashes.push(dmgsMsgList.valueHash)
              acc.push(msg)
              return acc
            })
            .catch(e => {
              console.log(e)
              return acc
            })
        })
      })
    })

    _.each(list.closures, closure => {
      const metas = {
        type: "closure",
        date:
          (closure.endOfPreviousDmg && moment(closure.endOfPreviousDmg).format("DD/MM/YYYY")) ||
          null,
        closure: "true",
        endOfPreviousDmg:
          (closure.endOfPreviousDmg && moment(closure.endOfPreviousDmg).format("DD/MM/YYYY")) ||
          null,
        beginOfNewDmg:
          (closure.beginOfNewDmg && moment(closure.beginOfNewDmg).format("DD/MM/YYYY")) || null,
        previousHcp: this.makeHcp(closure.previousHcParty),
        newHcp: this.makeHcp(closure.newHcParty),
        ssin: closure.inss || null
      }
      closure.inss && (patsDmgs[closure.inss] || (patsDmgs[closure.inss] = [])).push(metas)
      promMsg = promMsg.then(acc => {
        return this.saveMessageInDb(
          user,
          "Closure",
          closure,
          hcp,
          metas,
          docXApi,
          closure.endOfPreviousDmg,
          closure.inss
        ).then(msg => {
          closure.valueHash && msgHashes.push(closure.valueHash)
          acc.push(msg)
          return acc
        })
      })
    })

    _.each(list.extensions, ext => {
      const metas = {
        type: "extension",
        date: (ext.encounterDate && moment(ext.encounterDate).format("DD/MM/YYYY")) || null,
        from: (ext.encounterDate && moment(ext.encounterDate).format("DD/MM/YYYY")) || null,
        hcp: this.makeHcp(ext.hcParty),
        claim: ext.claim || null,
        ssin: ext.inss || null
      }
      ext.inss && (patsDmgs[ext.inss] || (patsDmgs[ext.inss] = [])).push(metas)
      promMsg = promMsg.then(acc => {
        return this.saveMessageInDb(
          user,
          "Extension",
          ext,
          hcp,
          metas,
          docXApi,
          ext.encounterDate,
          ext.inss
        ).then(msg => {
          ext.valueHash && msgHashes.push(ext.valueHash)
          acc.push(msg)
          return acc
        })
      })
    })

    return promMsg.then(acc =>
      Promise.all(
        _.chunk(Object.keys(patsDmgs), 100).map(ssins =>
          this.patientApi
            .filterBy(
              undefined,
              undefined,
              1000,
              0,
              undefined,
              false,
              new FilterChain({
                filter: new Filter({
                  $type: "PatientByHcPartyAndSsinsFilter",
                  healthcarePartyId: user.healthcarePartyId,
                  ssins: ssins
                })
              })
            )
            .then((pats: PatientPaginatedList) =>
              this.patientApi.bulkUpdatePatients(
                (pats.rows || []).map(p => {
                  const actions = _.sortBy(patsDmgs[p.ssin!!], "date")
                  const latestAction = actions.length && actions[actions.length - 1]

                  let phcp =
                    (p.patientHealthCareParties || (p.patientHealthCareParties = [])) &&
                    p.patientHealthCareParties.find(
                      phcp => phcp.healthcarePartyId === user.healthcarePartyId
                    )
                  if (!phcp) {
                    p.patientHealthCareParties.push(
                      (phcp = new PatientHealthCarePartyDto({
                        healthcarePartyId: user.healthcarePartyId,
                        referralPeriods: []
                      }))
                    )
                  }
                  if (!phcp.referralPeriods) {
                    phcp.referralPeriods = []
                  }

                  const rp =
                    (phcp.referralPeriods && phcp.referralPeriods.find(per => !per.endDate)) ||
                    (phcp.referralPeriods[phcp.referralPeriods.length] = new ReferralPeriod({}))

                  const actionDate = Number(
                    moment(latestAction.date, "DD/MM/YYYY").format("YYYYMMDD")
                  )

                  if (latestAction) {
                    if (latestAction.closure) {
                      rp.endDate = actionDate
                      rp.comment = `-> ${latestAction.newHcp}`
                    } else {
                      if (actionDate > (rp.startDate || 0)) {
                        rp.endDate = actionDate
                        phcp.referralPeriods.push(new ReferralPeriod({ startDate: actionDate }))
                      }
                    }
                  }
                  return p
                })
              )
            )
        )
      ).then(() => [ackHashes, msgHashes])
    )
  }

  private makeHcp(hcParty: HcpartyType | null | undefined) {
    if (!hcParty) {
      return null
    }
    return `${hcParty.firstname || ""} ${hcParty.familyname || ""} ${hcParty.name ||
      ""} [${(hcParty.ids &&
      (hcParty.ids.find(id => id.s === IDHCPARTY.SEnum.IDHCPARTY) || {}).value) ||
      "-"}]`
  }

  private saveMessageInDb(
    user: UserDto,
    msgName: string,
    dmgMessage: DmgsList | DmgClosure | DmgExtension,
    hcp: HealthcarePartyDto,
    metas: { [key: string]: string | null },
    docXApi: IccDocumentXApi,
    date?: Date,
    inss?: string,
    parentId?: string
  ) {
    return this.newInstance(user, {
      // tslint:disable-next-line:no-bitwise
      transportGuid: "GMD:IN:" + dmgMessage.reference,
      fromAddress: dmgMessage.io,
      sent: date && +date,
      toHealthcarePartyId: hcp.id,
      recipients: [hcp.id],
      recipientsType: "org.taktik.icure.entities.HealthcareParty",
      received: +new Date(),
      metas: metas,
      parentId: parentId,
      subject: inss
        ? `${msgName} from IO ${dmgMessage.io} for ${inss}`
        : `${msgName} from IO ${dmgMessage.io}`,
      senderReferences: {
        inputReference: dmgMessage.commonOutput && dmgMessage.commonOutput.inputReference,
        outputReference: dmgMessage.commonOutput && dmgMessage.commonOutput.outputReference,
        nipReference: dmgMessage.commonOutput && dmgMessage.commonOutput.nipReference
      }
    })
      .then(msg => this.createMessage(msg))
      .then(msg => {
        return docXApi
          .newInstance(user, msg, {
            mainUti: "public.json",
            name: `${msg.subject}_content.json`
          })
          .then(doc => docXApi.createDocument(doc))
          .then(doc =>
            docXApi.setAttachment(doc.id!!, undefined /*TODO provide keys for encryption*/, <any>(
              utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(dmgMessage)))
            ))
          )
          .then(() => msg)
      })
  }

  saveDmgListRequestInDb(
    user: UserDto,
    tack: string,
    resultMajor: string,
    appliesTo: string,
    hcp: HealthcarePartyDto,
    date?: Date,
    inss?: string
  ) {
    return this.newInstance(user, {
      // tslint:disable-next-line:no-bitwise
      transportGuid: "GMD:OUT:LIST" + appliesTo,
      sent: date && +date,
      toHealthcarePartyId: hcp.id,
      recipients: [hcp.id],
      recipientsType: "org.taktik.icure.entities.HealthcareParty",
      received: +new Date(),
      metas: { tack: tack, resultMajor: resultMajor },
      subject: inss ? `Dmg list request for ${inss}` : `Dmg list request`,
      senderReferences: {
        inputReference: appliesTo && _.last(appliesTo.split(":"))
      }
    }).then(msg => this.createMessage(msg))
  }

  // extractErrorMessage(es?: { itemId: string | null; error?: ErrorDetail }): string | undefined {
  //   const e = es && es.error
  //   return e &&
  //     (e.rejectionCode1 ||
  //       e.rejectionDescr1 ||
  //       e.rejectionCode2 ||
  //       e.rejectionDescr2 ||
  //       e.rejectionCode3 ||
  //       e.rejectionDescr3)
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

      return this.receiptXApi
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
          this.receiptXApi.setAttachment(rcpt.id, "tack", undefined, <any>(
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
              let ref = r.et20 && r.et20.reference.trim()
              if (r.et20 && r.et20.errorDetail) {
                errors.push({
                  itemId: decodeBase36Uuid(ref),
                  error: r.et20.errorDetail,
                  record: "ET20"
                })
                if (r.et80 && r.et80.errorDetail) {
                  errors.push({
                    itemId: decodeBase36Uuid(ref),
                    error: r.et80.errorDetail,
                    record: "ET80"
                  })
                }
              }

              _.each(r.items, i => {
                let ref = _.get(r, "et20.reference") //fallback
                if (i.et50 && i.et50.errorDetail) {
                  ref = _.get(i, "et50.itemReference")
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref.trim()),
                    error: i.et50.errorDetail,
                    record: "ET50"
                  })
                }
                if (i.et51 && i.et51.errorDetail) {
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref.trim()),
                    error: i.et51.errorDetail,
                    record: "ET51"
                  })
                }
                if (i.et52 && i.et52.errorDetail) {
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref.trim()),
                    error: i.et52.errorDetail,
                    record: "ET52"
                  })
                }
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
                  ? this.invoiceXApi.getInvoices(
                      new ListOfIdsDto({ ids: parentMessage.invoiceIds })
                    )
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
                    const errStructs = invoicingErrors.filter(it => it.itemId === ic.id)

                    if (rejectAll || errStructs.length) {
                      ic.logicalId = ic.logicalId || this.crypto.randomUuid()
                      ic.accepted = false
                      ic.canceled = true
                      ic.pending = false
                      ic.resent = false
                      ic.error =
                        _(errStructs)
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
                        this.invoiceXApi.modifyInvoice(iv)
                      ]
                    : [this.invoiceXApi.modifyInvoice(iv)]
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
                    return this.invoiceXApi.modifyInvoice(iv.invoiceDto).catch((err: any) => {
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
                      recipients: [fed.id],
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
                            mainUti: "public.json",
                            name: "920000_records"
                          }),
                          this.documentXApi.newInstance(user, msg, {
                            mainUti: "public.plain-text",
                            name: "920000"
                          })
                        ])
                      )
                      .then(([jsonDoc, doc]) =>
                        Promise.all([
                          this.documentXApi.createDocument(jsonDoc),
                          this.documentXApi.createDocument(doc)
                        ])
                      )
                      .then(([jsonDoc, doc]) =>
                        Promise.all([
                          this.documentXApi.setAttachment(
                            jsonDoc.id!!,
                            undefined /*TODO provide keys for encryption*/,
                            <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.records!!)))
                          ),
                          this.documentXApi.setAttachment(
                            doc.id!!,
                            undefined /*TODO provide keys for encryption*/,
                            <any>utils.ua2ArrayBuffer(utils.text2ua(res.detail!!))
                          )
                        ])
                      )
                      .then(() =>
                        this.receiptXApi.logReceipt(
                          user,
                          message.id!!,
                          [
                            `mycarenet:efact:inputReference:${res.inputReference}`,
                            res.tack!!.appliesTo!!,
                            res.tack!!.reference!!
                          ],
                          "tack",
                          utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.tack)))
                        )
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
            (promise = promise.then(patient =>
              this.crypto
                .appendObjectDelegations(
                  message,
                  parentObject,
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
                .then(extraData => _.extend(message, { delegations: extraData.delegations || {} }))
                .catch(e => {
                  console.log(e)
                  return message
                })
            ))
        )
        return promise
      })
  }
}
