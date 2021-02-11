import { iccEntityrefApi, iccInsuranceApi, iccMessageApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"
import { IccInvoiceXApi } from "./icc-invoice-x-api"

import * as _ from "lodash"
import * as moment from "moment"

import {
  AbstractFilterDtoPatient,
  EntityReferenceDto,
  FilterChainPatient,
  HealthcarePartyDto,
  InsuranceDto,
  InvoiceDto,
  ListOfIdsDto,
  MessageDto,
  PaginatedListPatientDto,
  PatientDto,
  PatientHealthCarePartyDto,
  ReceiptDto,
  ReferralPeriodDto,
  UserDto
} from "../icc-api/model/models"

import {
  decodeBase36Uuid,
  getFederaton,
  InvoiceWithPatient,
  toInvoiceBatch,
  uuidBase36,
  uuidBase36Half
} from "./utils/efact-util"
import { timeEncode } from "./utils/formatting-util"
import {
  DmgClosure,
  DmgExtension,
  DmgsList,
  EfactMessage,
  EfactSendResponse,
  ErrorDetail,
  fhcEfactApi,
  GenAsyncResponse,
  HcpartyType,
  IDHCPARTY
} from "@taktik/fhc-api"
import { utils } from "./crypto/utils"

import {
  EfactMessage920098Reader,
  EfactMessage920099Reader,
  EfactMessage920900Reader,
  EfactMessage920999Reader,
  EfactMessage931000Reader,
  EfactMessageReader,
  ET20_80Data,
  ET50Data,
  ET91Data,
  ET92Data,
  File920900Data
} from "./utils/efact-parser"

import { IccReceiptXApi } from "./icc-receipt-x-api"
import { IccPatientXApi } from "./icc-patient-x-api"

interface StructError {
  itemId: string | null
  error: ErrorDetail
  record: string
}

class EfactSendResponseWithError extends EfactSendResponse {
  public error: string | undefined

  constructor(json: JSON) {
    super(json)
  }
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
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    invoiceXApi: IccInvoiceXApi,
    documentXApi: IccDocumentXApi,
    receiptXApi: IccReceiptXApi,
    patientApi: IccPatientXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptXApi = receiptXApi
    this.invoiceXApi = invoiceXApi
    this.documentXApi = documentXApi
    this.patientApi = patientApi
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: UserDto, m: any) {
    return this.newInstanceWithPatient(user, null, m)
  }

  newInstanceWithPatient(user: UserDto, patient: PatientDto | null, m: any) {
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
      m || {}
    )

    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId)
      .then(secretForeignKeys =>
        this.crypto.initObjectDelegations(
          message,
          patient,
          hcpId!,
          secretForeignKeys.extractedKeys[0]
        )
      )
      .then(initData => {
        _.extend(message, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys
        })

        let promise = Promise.resolve(message)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(helement =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(
                  helement,
                  patient,
                  hcpId!,
                  delegateId,
                  initData.secretId
                )
                .then(extraData =>
                  _.extend(helement, {
                    delegations: extraData.delegations,
                    cryptedForeignKeys: extraData.cryptedForeignKeys
                  })
                )
                .catch(e => {
                  console.log(e)
                  return helement
                })
            ))
        )
        return promise
      })
  }

  saveDmgsListRequest(
    user: UserDto,
    req: GenAsyncResponse,
    requestDate?: number
  ): Promise<MessageDto> {
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
      metas: {
        type: "listrequest",
        date: moment().format("DD/MM/YYYY"),
        requestDate: requestDate ? moment(requestDate).format("DD/MM/YYYY") : ""
      },
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
            this.documentXApi.setDocumentAttachment(
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
          console.log(e.message)
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
        return this.findMessagesByTransportGuid(`GMD:OUT:${ref}`, false, undefined, undefined, 100)
          .then(parents => {
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
            ).then(msg => {
              dmgsMsgList.valueHash && msgHashes.push(dmgsMsgList.valueHash)
              acc.push(msg)
              return acc
            })
          })
          .catch(e => {
            console.log(e.message)
            return acc
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
        ssin: closure.inss || null,
        firstName: closure.firstName || null,
        lastName: closure.lastName || null,
        io: closure.io || null
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
        ssin: ext.inss || null,
        firstName: ext.firstName || null,
        lastName: ext.lastName || null,
        io: ext.io || null
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

    return promMsg.then(() =>
      Promise.all(
        _.chunk(Object.keys(patsDmgs), 100).map(ssins =>
          this.patientApi
            .filterByWithUser(
              user,
              undefined,
              undefined,
              1000,
              0,
              undefined,
              false,
              new FilterChainPatient({
                filter: new AbstractFilterDtoPatient({
                  $type: "PatientByHcPartyAndSsinsFilter",
                  healthcarePartyId: user.healthcarePartyId,
                  ssins: ssins
                })
              })
            )
            .then((pats: PaginatedListPatientDto) =>
              this.patientApi.bulkUpdatePatients(
                (pats.rows || []).map(p => {
                  const actions = _.sortBy(patsDmgs[p.ssin!!], a =>
                    moment(a.date, "DD/MM/YYYY").format("YYYYMMDD")
                  )
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
                    (phcp.referralPeriods[phcp.referralPeriods.length] = new ReferralPeriodDto({}))

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
                        phcp.referralPeriods.push(new ReferralPeriodDto({ startDate: actionDate }))
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
            docXApi.setDocumentAttachment(
              doc.id!!,
              undefined /*TODO provide keys for encryption*/,
              <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(dmgMessage)))
            )
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

  extractErrorMessage(error?: ErrorDetail): string | undefined {
    if (!error) return

    const code1 = Number(error.rejectionCode1)
    const code2 = Number(error.rejectionCode2)
    const code3 = Number(error.rejectionCode3)
    const desc1 = (error.rejectionDescr1 && error.rejectionDescr1.trim()) || ""
    const desc2 = (error.rejectionDescr2 && error.rejectionDescr2.trim()) || ""
    const desc3 = (error.rejectionDescr3 && error.rejectionDescr3.trim()) || ""

    return code1 || code2 || code3 || desc1 || desc2 || desc3
      ? _([
          code1 || desc1.length ? `${code1 || "XXXXXX"}: ${desc1 || " — "}` : null,
          code2 || desc2.length ? `${code2 || "XXXXXX"}: ${desc2 || " — "}` : null,
          code3 || desc3.length ? `${code3 || "XXXXXX"}: ${desc3 || " — "}` : null
        ])
          .compact()
          .uniq()
          .filter(err => err.indexOf("510119") < 0)
          .join("; ")
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

    return _.compact(_.map(errors, error => this.extractErrorMessage(error)))
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
        new Error(`Cannot find input reference from tack: ${_.get(efactMessage, "tack.appliesTo")}`)
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
          this.receiptXApi.setReceiptAttachment(rcpt.id!, "tack", "", <any>(
            utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(efactMessage)))
          ))
        )
        .then(() => {
          parentMessage.status = parentMessage.status!! | (1 << 8) /*STATUS_SUBMITTED*/

          // Reset error
          if (parentMessage.metas && parentMessage.metas.errors) {
            parentMessage.metas.sendingError = parentMessage.metas.errors
            delete parentMessage.metas.errors
          }
          return this.modifyMessage(parentMessage)
        })
    })
  }

  // Pass invoicePrefix if you want to generate the invoice reference from entityRef
  processEfactMessage(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage,
    invoicePrefix?: string,
    invoicePrefixer?: (invoice: InvoiceDto, hcpId: string) => Promise<string>
  ): Promise<{ message: MessageDto; invoices: Array<InvoiceDto> }> {
    const ref = efactMessage.commonOutput!!.inputReference
      ? Number(efactMessage.commonOutput!!.inputReference) % 10000000000
      : Number(efactMessage.commonOutput!!.outputReference!!.replace(/\D+/g, "")) % 10000000000
    return this.findMessagesByTransportGuid(
      "EFACT:BATCH:" + ref,
      false,
      undefined,
      undefined,
      100
    ).then(parents => {
      const msgsForHcp: MessageDto[] = _.filter(
        parents && parents.rows,
        (p: MessageDto) => p.responsible === hcp.id
      )
      if (!msgsForHcp.length) {
        throw new Error(`Cannot find parent with ref ${ref}`)
      }

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

      // Find message for Hcp based on the invoiceReference if present (!931000)
      const fileReference = _.get(parsedRecords, "et10.invoiceReference")
      const parentMessage = fileReference
        ? _.find(msgsForHcp, m => uuidBase36(m.id!!) === fileReference.trim())
        : msgsForHcp[0]

      if (!parentMessage) {
        throw new Error(`Cannot match parent with fileReference for file with ref ${ref}`)
      }

      const errors = this.extractErrors(parsedRecords)
      const statuses =
        (["920999", "920099"].includes(messageType) ? 1 << 17 /*STATUS_FULL_ERROR*/ : 0) |
        (["920900"].includes(messageType) && errors.length
          ? 1 << 16 /*STATUS_PARTIAL_SUCCESS*/
          : 0) |
        (["920900"].includes(messageType) && !errors.length ? 1 << 15 /*STATUS_FULL_SUCCESS*/ : 0) |
        (["920999"].includes(messageType) ? 1 << 12 /*STATUS_REJECTED*/ : 0) |
        (["920900", "920098", "920099"].includes(messageType) ? 1 << 11 /*STATUS_ACCEPTED*/ : 0) |
        (["920098"].includes(messageType) && errors.length
          ? 1 << 22 /*STATUS_ERRORS_IN_PRELIMINARY_CONTROL*/
          : 0) |
        (["931000"].includes(messageType) ? 1 << 10 /*STATUS_ACCEPTED_FOR_TREATMENT*/ : 0) |
        (["931000", "920999"].includes(messageType) ? 1 << 9 /*STATUS_RECEIVED*/ : 0)

      const batchErrors: ErrorDetail[] | undefined = _.compact([
        _.get(parsedRecords, "zone200.errorDetail"),
        _.get(parsedRecords, "zone300.errorDetail"),
        _.get(parsedRecords, "et10.errorDetail"),
        _.get(parsedRecords, "et90.errorDetail")
      ])

      const invoicingErrors: StructError[] = parsedRecords.records
        ? _.compact(
            _.flatMap(parsedRecords.records as ET20_80Data[], r => {
              const errors: StructError[] = []
              let refEt20 = r.et20 && r.et20.reference.trim()
              if (r.et20 && r.et20.errorDetail) {
                errors.push({
                  itemId: decodeBase36Uuid(refEt20),
                  error: r.et20.errorDetail,
                  record: "ET20"
                })
                if (r.et80 && r.et80.errorDetail) {
                  errors.push({
                    itemId: decodeBase36Uuid(refEt20),
                    error: r.et80.errorDetail,
                    record: "ET80"
                  })
                }
              }

              _.each(r.items, i => {
                let ref = (i.et50 && i.et50.itemReference.trim()) || refEt20 //fallback
                if (i.et50 && i.et50.errorDetail) {
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref),
                    error: i.et50.errorDetail,
                    record: "ET50"
                  })
                }
                if (i.et51 && i.et51.errorDetail) {
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref),
                    error: i.et51.errorDetail,
                    record: "ET51"
                  })
                }
                if (i.et52 && i.et52.errorDetail) {
                  errors.push({
                    itemId: ref && decodeBase36Uuid(ref),
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
                this.documentXApi.setDocumentAttachment(
                  doc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  <any>utils.ua2ArrayBuffer(utils.text2ua(efactMessage.detail!!))
                ),
                this.documentXApi.setDocumentAttachment(
                  jsonDoc.id!!,
                  undefined /*TODO provide keys for encryption*/,
                  <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(efactMessage)))
                ),
                this.documentXApi.setDocumentAttachment(
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
            .then((invoices: Array<InvoiceDto>) => {
              // RejectAll if "920999", "920099"
              const rejectAll = (statuses & (1 << 17)) /*STATUS_ERROR*/ > 0

              let promise: Promise<Array<InvoiceDto>> = Promise.resolve([])
              _.forEach(invoices, iv => {
                let newInvoicePromise: Promise<InvoiceDto> | null = null
                promise = promise.then(invoices => {
                  iv.error =
                    _(invoicingErrors)
                      .filter(it => it.itemId === iv.id)
                      .map(e => this.extractErrorMessage(e.error))
                      .compact()
                      .join("; ") || undefined

                  _.each(iv.invoicingCodes, ic => {
                    // If the invoicing code is already treated, do not treat it
                    if (ic.canceled || ic.accepted) {
                      return
                    }
                    // Error from the ET50/51/52 linked to the invoicingCode
                    const codeError =
                      _(invoicingErrors)
                        .filter(it => it.itemId === ic.id)
                        .map(e => this.extractErrorMessage(e.error))
                        .compact()
                        .join("; ") || undefined

                    const record50: ET50Data | false =
                      messageType === "920900" &&
                      _.compact(
                        _.flatMap((parsedRecords as File920900Data).records, r =>
                          r.items!!.map(
                            i =>
                              _.get(i, "et50.itemReference") &&
                              decodeBase36Uuid(i.et50!!.itemReference.trim()) === ic.id &&
                              i.et50
                          )
                        )
                      )[0]

                    const zone114amount =
                      record50 &&
                      _.get(record50, "errorDetail.zone114") &&
                      Number(record50.errorDetail!!.zone114)

                    if (rejectAll || codeError) {
                      ic.accepted = false
                      ic.canceled = true
                      ic.pending = false
                      ic.resent = false
                      ic.error = codeError
                      ic.paid = zone114amount ? Number((zone114amount / 100).toFixed(2)) : 0

                      newInvoicePromise = (
                        newInvoicePromise ||
                        this.patientApi
                          .getPatientIdOfChildDocumentForHcpAndHcpParents(
                            iv,
                            user.healthcarePartyId!
                          )
                          .then(patientId => this.patientApi.getPatientWithUser(user, patientId!))
                          .then(pat =>
                            this.invoiceXApi.newInstance(
                              user,
                              pat,
                              _.omit(iv, [
                                "id",
                                "rev",
                                "deletionDate",
                                "created",
                                "modified",
                                "sentDate",
                                "printedDate",
                                "secretForeignKeys",
                                "cryptedForeignKeys",
                                "delegations",
                                "encryptionKeys",
                                "invoicingCodes",
                                "error",
                                "receipts",
                                "encryptedSelf"
                              ])
                            )
                          )
                          .then(niv => {
                            iv.correctiveInvoiceId = niv.id
                            niv.correctedInvoiceId = iv.id
                            return niv
                          })
                      ).then(niv => {
                        niv.invoicingCodes = (niv.invoicingCodes || []).concat(
                          _.assign({}, ic, {
                            id: this.crypto.randomUuid(),
                            accepted: false,
                            canceled: false,
                            pending: true,
                            resent: true,
                            archived: false
                          })
                        )
                        return niv
                      })
                    } else {
                      ic.accepted = true
                      ic.canceled = false
                      ic.pending = false
                      ic.resent = false
                      ic.error = undefined
                      ic.paid = zone114amount
                        ? Number((zone114amount / 100).toFixed(2))
                        : ic.reimbursement
                    }
                  })
                  return (newInvoicePromise
                    ? newInvoicePromise
                        .then(niv =>
                          (invoicePrefixer
                            ? invoicePrefixer(niv, user.healthcarePartyId!)
                            : Promise.resolve(invoicePrefix)
                          ).then(pfx => this.invoiceXApi.createInvoice(niv, pfx))
                        )
                        .then(niv => invoices.push(niv))
                    : Promise.resolve(0)
                  )
                    .then(() => this.invoiceXApi.modifyInvoice(iv))
                    .then(iv => invoices.push(iv))
                    .then(() => invoices)
                })
              })

              return promise
            })
            .then(invoices => {
              parentMessage.status = (parentMessage.status || 0) | statuses

              if (batchErrors.length) {
                parentMessage.metas = _.assign(parentMessage.metas || {}, {
                  errors: _(batchErrors)
                    .map(this.extractErrorMessage)
                    .uniq()
                    .compact()
                    .value()
                    .join("; ")
                })
              }

              if (parsedRecords.et91) {
                let et91s = parsedRecords.et91 as Array<ET91Data>
                parentMessage.metas = _.assign(parentMessage.metas || {}, {
                  paymentReferenceAccount1: _(et91s)
                    .map(et91 => et91.paymentReferenceAccount1)
                    .uniq()
                    .value()
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
              return this.modifyMessage(parentMessage).then(
                message =>
                  ({ message, invoices } as { message: MessageDto; invoices: Array<InvoiceDto> })
              )
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
    efactApi: fhcEfactApi,
    fhcServer: string | undefined = undefined,
    prefixer?: (fed: InsuranceDto, hcpId: string) => Promise<string>,
    isConnectedAsPmg: boolean = false,
    medicalLocationId: string | null = null
  ): Promise<MessageDto> {
    const uuid = this.crypto.randomUuid()
    const smallBase36 = uuidBase36Half(uuid)
    const fullBase36 = uuidBase36(uuid)
    const sentDate = +new Date()
    const errors: Array<string> = []
    const year = moment().year()

    return getFederaton(invoices, this.insuranceApi).then(fed => {
      return (prefixer
        ? prefixer(fed, hcp.id!)
        : Promise.resolve(
            `efact:${hcp.id}:${year}:${
              fed.code === "306" ? "300" : fed.code === "675" ? "600" : fed.code
            }:`
          )
      ).then(prefix => {
        return this.entityReferenceApi
          .getLatest(prefix)
          .then((er: EntityReferenceDto) => {
            let nextSeqNumber =
              er && er.id && er.id!.startsWith(prefix)
                ? (Number(er.id!.split(":").pop()) || 0) + 1
                : 1
            return this.entityReferenceApi.createEntityReference(
              new EntityReferenceDto({
                id: prefix + _.padStart("" + (nextSeqNumber % 1000000000), 9, "0"),
                docId: uuid
              })
            )
          })
          .then(er =>
            toInvoiceBatch(
              invoices,
              hcp,
              fullBase36,
              er && er.id ? Number(er.id.substr(prefix.length)) % 1000 : 0,
              smallBase36,
              this.insuranceApi,
              this.invoiceXApi,
              this,
              medicalLocationId === "medicalhouse"
            )
          )
          .then(batch =>
            efactApi
              .sendBatchUsingPOST(xFHCKeystoreId, xFHCTokenId, xFHCPassPhrase, batch)
              //.then(() => { throw "ERREUR FORCEE" })
              .catch(err => {
                // The FHC has crashed but the batch could be sent, so be careful !
                const errorMessage = _.get(
                  err,
                  "message",
                  err.toString ? err.toString() : "Server error"
                )
                const blockingErrors = [
                  "Gateway Timeout", // based on the user feedback (including Frederic)
                  "Failed to fetch" // is due to internet connection lost (shutdown wifi just before sending batch)
                ]

                if (_.includes(blockingErrors, errorMessage.trim())) {
                  throw errorMessage
                }
                return { error: errorMessage }
              })
              .then((res: EfactSendResponseWithError) => {
                if (res.success || res.error) {
                  let promise = Promise.resolve(null)
                  let totalAmount = 0
                  _.forEach(invoices, iv => {
                    promise = promise.then(() => {
                      _.forEach(iv.invoiceDto.invoicingCodes, code => {
                        code.pending = true // STATUS_PENDING
                        totalAmount += code.reimbursement || 0
                      })
                      iv.invoiceDto.sentDate = sentDate
                      return this.invoiceXApi
                        .modifyInvoice(iv.invoiceDto)
                        .then(() => null)
                        .catch(() => {
                          errors.push(`efac-management.CANNOT_UPDATE_INVOICE.${iv.invoiceDto.id}`)
                          return null
                        })
                    })
                  })
                  return promise
                    .then(() =>
                      this.newInstance(user, {
                        id: uuid,
                        medicalLocationId,
                        invoiceIds: invoices.map(i => i.invoiceDto.id),
                        // tslint:disable-next-line:no-bitwise
                        status: 1 << 6, // STATUS_EFACT
                        externalRef: _.padStart("" + batch.uniqueSendNumber, 3, "0"),
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
                          status:
                            (message.status || 0) | (res.success ? 1 << 7 : 0) /*STATUS_SENT*/,
                          metas: {
                            ioFederationCode: batch.ioFederationCode,
                            numericalRef: batch.numericalRef,
                            invoiceMonth: _.padStart("" + batch.invoicingMonth, 2, "0"),
                            invoiceYear: _.padStart("" + batch.invoicingYear, 4, "0"),
                            totalAmount: totalAmount,
                            fhc_server: fhcServer,
                            errors: res.error
                          }
                        })
                      )
                    )
                    .then((msg: MessageDto) => {
                      if (res.success) {
                        // Continue even if error ...
                        this.saveMessageAttachment(user, msg, res)
                      }
                      return msg
                    })
                } else {
                  throw "Cannot send batch"
                }
              })
          )
          .catch(err => {
            console.log(err)
            errors.push(err)
            throw new Error(errors.join(","))
          })
      })
    })
  }

  saveMessageAttachment(user: UserDto, msg: MessageDto, res: EfactSendResponseWithError) {
    return Promise.all([
      this.documentXApi.newInstance(user, msg, {
        mainUti: "public.json",
        name: "920000_records"
      }),
      this.documentXApi.newInstance(user, msg, {
        mainUti: "public.plain-text",
        name: "920000"
      })
    ])
      .then(([jsonDoc, doc]) =>
        Promise.all([
          this.documentXApi.createDocument(jsonDoc),
          this.documentXApi.createDocument(doc)
        ])
      )
      .then(([jsonDoc, doc]) =>
        Promise.all([
          this.documentXApi.setDocumentAttachment(
            jsonDoc.id!!,
            undefined /*TODO provide keys for encryption*/,
            <any>utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.records!!)))
          ),
          this.documentXApi.setDocumentAttachment(
            doc.id!!,
            undefined /*TODO provide keys for encryption*/,
            <any>utils.ua2ArrayBuffer(utils.text2ua(res.detail!!))
          )
        ])
      )
      .then(() =>
        this.receiptXApi.logReceipt(
          user,
          msg.id!!,
          [
            `mycarenet:efact:inputReference:${res.inputReference}`,
            res.tack!!.appliesTo!!,
            res.tack!!.reference!!
          ],
          "tack",
          utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(res.tack)))
        )
      )
  }
}
