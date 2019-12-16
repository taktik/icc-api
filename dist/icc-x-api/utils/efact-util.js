"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const models_1 = require("../../icc-api/model/models")
const fhc_api_1 = require("fhc-api")
const formatting_util_1 = require("./formatting-util")
const fhc_patient_util_1 = require("./fhc-patient-util")
const fhc_invoice_sender_util_1 = require("./fhc-invoice-sender-util")
const insurability_util_1 = require("./insurability-util")
const _ = require("lodash")
const uuid_encoder_1 = require("./uuid-encoder")
const moment = require("moment")
const base36UUID = new uuid_encoder_1.UuidEncoder()
function ensureNoFederation(invoices, insurances) {
  // We will check here for recipient which are federations (except 306).
  const federations = insurances.filter(i => i.code !== "306" && i.id === i.parent)
  if (federations.length > 0) {
    console.error(
      `Invoices directed to ${federations.map(i => i.code).join()}, invoices ${invoices.map(
        i => i.invoiceDto.id
      )}`
    )
    throw "Some invoices are directly destinated to federations inside of mutuality office !"
  }
}
function getFederaton(invoices, insuranceApi) {
  return insuranceApi
    .getInsurances(
      new models_1.ListOfIdsDto({
        ids: _.compact(invoices.map(iwp => iwp.invoiceDto.recipientId))
      })
    )
    .then(insurances => {
      ensureNoFederation(invoices, insurances)
      return insuranceApi
        .getInsurances(
          new models_1.ListOfIdsDto({ ids: _.uniq(_.compact(insurances.map(i => i.parent))) })
        )
        .then(parents => {
          const parentsWithFedCode = parents.filter(i => i.code)
          if (!parentsWithFedCode.length) {
            throw "The federation is missing from the recipients of the invoices"
          }
          if (parentsWithFedCode.length > 1) {
            throw "The provided invoices are not addressed to insurances belonging to the same federation"
          }
          return parentsWithFedCode[0]
        })
    })
}
exports.getFederaton = getFederaton
function getRelatedInvoicesInfo(invoicesWithPatient, insuranceApi, invoiceXApi, messageXApi) {
  // Return the id of the related parentInvoice
  const getRelatedInvoiceId = iv =>
    (iv.creditNote && iv.creditNoteRelatedInvoiceId) || iv.correctedInvoiceId
  return Promise.resolve(invoicesWithPatient).then(invoicesWithPatient => {
    const invoices = _(invoicesWithPatient)
      .map(iwp => iwp.invoiceDto)
      .filter(piv => !!getRelatedInvoiceId(piv))
      .value()
    if (invoices.length === 0) {
      return Promise.resolve([])
    }
    const relatedInvoiceIds = new models_1.ListOfIdsDto({
      ids: invoices.map(iv => getRelatedInvoiceId(iv))
    })
    return Promise.all([
      messageXApi.listMessagesByInvoiceIds(relatedInvoiceIds),
      invoiceXApi.getInvoices(relatedInvoiceIds)
    ]).then(result => {
      const messages = result[0]
      const relatedInvoices = result[1]
      const insuranceIds = _(relatedInvoices)
        .map(civ => civ.recipientId)
        .uniq()
        .value()
      return insuranceApi
        .getInsurances(new models_1.ListOfIdsDto({ ids: insuranceIds }))
        .then(insurances => {
          const relatedInvoicesInfo = []
          _.forEach(invoices, invoice => {
            const relatedInvoice = _.find(
              relatedInvoices,
              riv => !!(riv.id === getRelatedInvoiceId(invoice))
            )
            const message = _.find(
              messages,
              m => !!(relatedInvoice && m.invoiceIds.indexOf(relatedInvoice.id) > -1)
            )
            const insurance = _.find(
              insurances,
              ins => !!(relatedInvoice && ins.id === relatedInvoice.recipientId)
            )
            if (!relatedInvoice || !message || !insurance) return
            relatedInvoicesInfo.push({
              invoiceId: invoice.id,
              insuranceCode: insurance.code,
              invoiceReference: relatedInvoice.invoiceReference,
              sendNumber: message.externalRef,
              invoicingYear: _.padStart(message.metas.invoiceYear, 4, "0"),
              invoicingMonth: _.padStart(message.metas.invoiceMonth, 2, "0")
            })
          })
          return relatedInvoicesInfo
        })
    })
  })
}
exports.getRelatedInvoicesInfo = getRelatedInvoicesInfo
// Here we trust the invoices argument for grouping validity (month, year and patient)
function toInvoiceBatch(
  invoicesWithPatient,
  hcp,
  batchRef,
  batchNumber,
  fileRef,
  insuranceApi,
  invoiceXApi,
  messageXApi
) {
  return insuranceApi
    .getInsurances(
      new models_1.ListOfIdsDto({
        ids: _.compact(invoicesWithPatient.map(iwp => iwp.invoiceDto.recipientId))
      })
    )
    .then(insurances => {
      ensureNoFederation(invoicesWithPatient, insurances)
      return insuranceApi
        .getInsurances(
          new models_1.ListOfIdsDto({ ids: _.uniq(_.compact(insurances.map(i => i.parent))) })
        )
        .then(parents => {
          const fedCodes = _.compact(parents.map(i => i.code && i.code.substr(0, 3)))
          if (!fedCodes.length) {
            throw "The federation is missing from the recipients of the invoices"
          }
          if (fedCodes.length > 1) {
            throw "The provided invoices are not addressed to insurances belonging to the same federation"
          }
          return getRelatedInvoicesInfo(
            invoicesWithPatient,
            insuranceApi,
            invoiceXApi,
            messageXApi
          ).then(relatedInvoicesInfo => {
            const invoicesBatch = new fhc_api_1.InvoicesBatch({})
            invoicesBatch.batchRef = batchRef
            invoicesBatch.fileRef = fileRef
            invoicesBatch.invoices = _.map(invoicesWithPatient, invWithPat => {
              const invoice = invWithPat.aggregatedInvoice || invWithPat.invoiceDto
              const relatedInvoiceInfo = _.find(
                relatedInvoicesInfo,
                rivi => rivi.invoiceId === invoice.id
              )
              const insurance = insurances.find(ins => ins.id === invoice.recipientId)
              if (!insurance) {
                throw "Insurance is invalid for patient " + invWithPat.patientDto.id
              }
              return toInvoice(
                hcp.nihii,
                invoice,
                invWithPat.patientDto,
                insurance,
                relatedInvoiceInfo
              )
            })
            const now = new Date()
            const invoiceDate = formatting_util_1.toMoment(
              invoicesWithPatient[0].invoiceDto.invoiceDate
            )
            const invoicingMonth = invoiceDate.month() + 1
            const invoicingYear = invoiceDate.year()
            // The OA 500, matches the monthYear (zone 300) to check the batch sending number
            // Use sending year to prevent duplicate sending number in case of invoices made
            // on the previous year
            if (now.getFullYear() === invoicingYear) {
              invoicesBatch.invoicingMonth = invoicingMonth
              invoicesBatch.invoicingYear = invoicingYear
            } else {
              invoicesBatch.invoicingMonth = now.getMonth() + 1
              invoicesBatch.invoicingYear = now.getFullYear()
            }
            invoicesBatch.ioFederationCode = fedCodes[0]
            invoicesBatch.numericalRef =
              moment().get("year") * 1000000 + Number(fedCodes[0]) * 1000 + batchNumber
            invoicesBatch.sender = fhc_invoice_sender_util_1.toInvoiceSender(hcp, fedCodes[0])
            invoicesBatch.uniqueSendNumber = batchNumber
            return invoicesBatch
          })
        })
    })
}
exports.toInvoiceBatch = toInvoiceBatch
function toInvoice(nihiiHealthcareProvider, invoiceDto, patientDto, insurance, relatedInvoiceInfo) {
  const invoice = new fhc_api_1.Invoice({})
  const invoiceYear = moment(invoiceDto.created)
    .year()
    .toString()
  invoice.hospitalisedPatient = insurability_util_1.isPatientHospitalized(patientDto)
  // FIXME : coder l'invoice ref
  invoice.invoiceNumber = Number(invoiceYear + invoiceDto.invoiceReference) || 0
  // FIXME : coder l'invoice ref
  invoice.invoiceRef = uuidBase36(invoiceDto.id)
  invoice.ioCode = insurance.code.substr(0, 3)
  invoice.items = _.map(invoiceDto.invoicingCodes, invoicingCodeDto => {
    return toInvoiceItem(
      invoiceDto.supervisorNihii || nihiiHealthcareProvider,
      patientDto,
      invoiceDto,
      invoicingCodeDto
    )
  })
  invoice.patient = fhc_patient_util_1.toPatient(patientDto)
  invoice.ignorePrescriptionDate = !!invoiceDto.longDelayJustification
  invoice.creditNote = invoiceDto.creditNote
  if (relatedInvoiceInfo) {
    invoice.relatedBatchSendNumber = Number(relatedInvoiceInfo.sendNumber)
    invoice.relatedBatchYearMonth = Number(
      relatedInvoiceInfo.invoicingYear + relatedInvoiceInfo.invoicingMonth
    )
    invoice.relatedInvoiceNumber = Number(
      relatedInvoiceInfo.invoicingYear + relatedInvoiceInfo.invoiceReference
    )
    invoice.relatedInvoiceIoCode = relatedInvoiceInfo.insuranceCode
  }
  // TODO : fix me later
  invoice.reason = fhc_api_1.Invoice.ReasonEnum.Other
  invoice.creditNote = invoiceDto.creditNote
  return invoice
}
function toInvoiceItem(nihiiHealthcareProvider, patientDto, invoiceDto, invoicingCode) {
  const invoiceItem = new fhc_api_1.InvoiceItem({})
  invoiceItem.codeNomenclature = Number(invoicingCode.tarificationId.split("|")[1])
  invoiceItem.dateCode = formatting_util_1.dateEncode(
    formatting_util_1.toMoment(invoicingCode.dateCode).toDate()
  )
  invoiceItem.doctorIdentificationNumber = nihiiHealthcareProvider
  invoiceItem.doctorSupplement = Number(((invoicingCode.doctorSupplement || 0) * 100).toFixed(0))
  if (invoicingCode.eidReadingHour && invoicingCode.eidReadingValue) {
    invoiceItem.eidItem = new fhc_api_1.EIDItem({
      deviceType: "1",
      readType: "1",
      readDate: invoiceItem.dateCode,
      readHour: invoicingCode.eidReadingHour,
      readvalue: invoicingCode.eidReadingValue
    })
  }
  invoiceItem.gnotionNihii = invoiceDto.gnotionNihii
  invoiceItem.insuranceRef = invoicingCode.contract || undefined // Must be != ""
  invoiceItem.insuranceRefDate = invoicingCode.contractDate || invoiceItem.dateCode
  invoiceItem.invoiceRef = uuidBase36(invoicingCode.id)
  invoiceItem.override3rdPayerCode = invoicingCode.override3rdPayerCode
  invoiceItem.patientFee = Number(((invoicingCode.patientIntervention || 0) * 100).toFixed(0))
  invoiceItem.percentNorm = fhc_api_1.InvoiceItem.PercentNormEnum.None
  invoiceItem.personalInterventionCoveredByThirdPartyCode =
    invoicingCode.cancelPatientInterventionReason
  invoiceItem.prescriberNihii = invoicingCode.prescriberNihii
  invoiceItem.prescriberNorm = getPrescriberNorm(invoicingCode.prescriberNorm || 0)
  invoiceItem.reimbursedAmount = Number(((invoicingCode.reimbursement || 0) * 100).toFixed(0))
  invoiceItem.relatedCode = Number(invoicingCode.relatedCode || 0)
  invoiceItem.sideCode = getSideCode(invoicingCode.side || 0)
  invoiceItem.timeOfDay = getTimeOfDay(invoicingCode.timeOfDay || 0)
  invoiceItem.units = invoicingCode.units || 1
  invoiceItem.derogationMaxNumber = getDerogationMaxNumber(invoicingCode.derogationMaxNumber || 0)
  invoiceItem.internshipNihii = invoiceDto.internshipNihii
  return invoiceItem
}
function getSideCode(code) {
  return code === 0
    ? fhc_api_1.InvoiceItem.SideCodeEnum.None
    : code === 1
      ? fhc_api_1.InvoiceItem.SideCodeEnum.Left
      : code === 2
        ? fhc_api_1.InvoiceItem.SideCodeEnum.Right
        : fhc_api_1.InvoiceItem.SideCodeEnum.None
}
function getTimeOfDay(code) {
  return code === 0
    ? fhc_api_1.InvoiceItem.TimeOfDayEnum.Other
    : code === 1
      ? fhc_api_1.InvoiceItem.TimeOfDayEnum.Night
      : code === 2
        ? fhc_api_1.InvoiceItem.TimeOfDayEnum.Weekend
        : code === 3
          ? fhc_api_1.InvoiceItem.TimeOfDayEnum.Bankholiday
          : code === 4
            ? fhc_api_1.InvoiceItem.TimeOfDayEnum.Urgent
            : fhc_api_1.InvoiceItem.TimeOfDayEnum.Other
}
function getPrescriberNorm(code) {
  return code === 0
    ? fhc_api_1.InvoiceItem.PrescriberNormEnum.None
    : code === 1
      ? fhc_api_1.InvoiceItem.PrescriberNormEnum.OnePrescriber
      : code === 3
        ? fhc_api_1.InvoiceItem.PrescriberNormEnum.SelfPrescriber
        : code === 4
          ? fhc_api_1.InvoiceItem.PrescriberNormEnum.AddedCode
          : code === 9
            ? fhc_api_1.InvoiceItem.PrescriberNormEnum.ManyPrescribers
            : fhc_api_1.InvoiceItem.PrescriberNormEnum.None
}
function getDerogationMaxNumber(code) {
  return code === 0
    ? fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.Other
    : code === 1
      ? fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.DerogationMaxNumber
      : code === 2
        ? fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.OtherPrescription
        : code === 3
          ? fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.SecondPrestationOfDay
          : fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.ThirdAndNextPrestationOfDay
}
exports.getDerogationMaxNumber = getDerogationMaxNumber
function toDerogationMaxNumber(derogation) {
  return derogation === fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.Other
    ? 0
    : derogation === fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.DerogationMaxNumber
      ? 1
      : derogation === fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.OtherPrescription
        ? 2
        : derogation === fhc_api_1.InvoiceItem.DerogationMaxNumberEnum.SecondPrestationOfDay
          ? 3
          : 4
}
exports.toDerogationMaxNumber = toDerogationMaxNumber
function uuidBase36(uuid) {
  return base36UUID.encode(uuid)
}
exports.uuidBase36 = uuidBase36
/**
 * This function encodes an uuid in 13 characters in base36, this is
 * for the fileRef in efact, zone 303
 */
function uuidBase36Half(uuid) {
  const rawEndcode = base36UUID.encode(uuid.substr(0, 18))
  return _.padStart(rawEndcode, 13, "0")
}
exports.uuidBase36Half = uuidBase36Half
function decodeBase36Uuid(base36) {
  try {
    const decoded = base36UUID.decode(base36)
    if (base36.length !== 13) {
      return decoded
    } else {
      const truncated = decoded.substr(19, decoded.length)
      const raw = truncated.replace(/-/g, "")
      const formatted = raw.substr(0, 8) + "-" + raw.substring(8, 12) + "-" + raw.substring(12, 16)
      return formatted
    }
  } catch (e) {
    console.log("Cannot interpret: " + base36, e)
  }
  return null
}
exports.decodeBase36Uuid = decodeBase36Uuid
//# sourceMappingURL=efact-util.js.map
