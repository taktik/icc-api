import {
  HealthcarePartyDto,
  InsuranceDto,
  InvoiceDto,
  InvoicingCodeDto,
  ListOfIdsDto,
  PatientDto
} from "../../icc-api/model/models"

import { InvoicesBatch, InvoiceItem, Invoice, EIDItem } from "fhc-api/dist/model/models"
import { dateEncode, toMoment } from "./formatting-util"
import { toPatient } from "./fhc-patient-util"
import { toInvoiceSender } from "./fhc-invoice-sender-util"
import { isPatientHospitalized, getInsurability } from "./insurability-util"
import * as _ from "lodash"
import { iccInsuranceApi } from "../../icc-api/api/iccInsuranceApi"
import { UuidEncoder } from "./uuid-encoder"
import moment from "moment"

export interface InvoiceWithPatient {
  invoiceDto: InvoiceDto
  patientDto: PatientDto
  aggregatedInvoice?: InvoiceDto
}

const base36UUID = new UuidEncoder()

export function getFederaton(
  invoices: Array<InvoiceWithPatient>,
  insuranceApi: iccInsuranceApi
): Promise<InsuranceDto> {
  return insuranceApi
    .getInsurances(
      new ListOfIdsDto({
        ids: _.compact(invoices.map(iwp => getInsurability(iwp.patientDto).insuranceId))
      })
    )
    .then((insurances: Array<InsuranceDto>) => {
      return insuranceApi
        .getInsurances(new ListOfIdsDto({ ids: _.uniq(_.compact(insurances.map(i => i.parent))) }))
        .then((parents: Array<InsuranceDto>) => {
          const fedCodes = _.compact(parents.map(i => i.code && i.code.substr(0, 3)))
          if (!fedCodes.length) {
            throw "The federation is missing from the recipients of the invoices"
          }
          if (fedCodes.length > 1) {
            throw "The provided invoices are not addressed to insurances belonging to the same federation"
          }
          return parents[0]
        })
    })
}

// Here we trust the invoices argument for grouping validity (month, year and patient)
export function toInvoiceBatch(
  invoices: Array<InvoiceWithPatient>,
  hcp: HealthcarePartyDto,
  batchRef: string,
  batchNumber: number,
  fileRef: string,
  insuranceApi: iccInsuranceApi
): Promise<InvoicesBatch> {
  return insuranceApi
    .getInsurances(
      new ListOfIdsDto({
        ids: _.compact(invoices.map(iwp => getInsurability(iwp.patientDto).insuranceId))
      })
    )
    .then((insurances: Array<InsuranceDto>) => {
      return insuranceApi
        .getInsurances(new ListOfIdsDto({ ids: _.uniq(_.compact(insurances.map(i => i.parent))) }))
        .then((parents: Array<InsuranceDto>) => {
          const fedCodes = _.compact(parents.map(i => i.code && i.code.substr(0, 3)))
          if (!fedCodes.length) {
            throw "The federation is missing from the recipients of the invoices"
          }
          if (fedCodes.length > 1) {
            throw "The provided invoices are not addressed to insurances belonging to the same federation"
          }

          const invoicesBatch = new InvoicesBatch({})

          invoicesBatch.batchRef = batchRef
          invoicesBatch.fileRef = fileRef
          invoicesBatch.invoices = _.map(invoices, (invWithPat: InvoiceWithPatient) => {
            const invoice = invWithPat.aggregatedInvoice
              ? invWithPat.aggregatedInvoice
              : invWithPat.invoiceDto

            const ins = insurances.find(
              i => i.id === getInsurability(invWithPat.patientDto).insuranceId
            )
            if (!ins) {
              throw "Insurance is invalid for patient " + invWithPat.patientDto.id
            }
            return toInvoice(hcp.nihii!!, invoice, invWithPat.patientDto, ins)
          })
          invoicesBatch.invoicingMonth =
            toMoment(invoices[0].invoiceDto.invoiceDate!!)!!.month() + 1
          invoicesBatch.invoicingYear = toMoment(invoices[0].invoiceDto.invoiceDate!!)!!.year()
          invoicesBatch.ioFederationCode = fedCodes[0]
          invoicesBatch.numericalRef =
            moment().get("year") * 1000000 + Number(fedCodes[0]) * 1000 + batchNumber
          invoicesBatch.sender = toInvoiceSender(hcp)
          invoicesBatch.uniqueSendNumber = batchNumber

          return invoicesBatch
        })
    })
}

function toInvoice(
  nihiiHealthcareProvider: string,
  invoiceDto: InvoiceDto,
  patientDto: PatientDto,
  insurance: InsuranceDto
): Invoice {
  const invoice = new Invoice({})

  invoice.hospitalisedPatient = isPatientHospitalized(patientDto)
  // FIXME : coder l'invoice ref
  invoice.invoiceNumber = Number(invoiceDto.invoiceReference) || 0
  // FIXME : coder l'invoice ref
  invoice.invoiceRef = uuidBase36(invoiceDto.id!!)
  invoice.ioCode = insurance.code!!.substr(0, 3)
  invoice.items = _.map(invoiceDto.invoicingCodes, (invoicingCodeDto: InvoicingCodeDto) => {
    return toInvoiceItem(nihiiHealthcareProvider, patientDto, invoiceDto, invoicingCodeDto)
  })
  invoice.patient = toPatient(patientDto)
  invoice.ignorePrescriptionDate = !!invoiceDto.longDelayJustification

  // TODO : fix me later
  invoice.reason = Invoice.ReasonEnum.Other
  invoice.creditNote = invoiceDto.creditNote
  return invoice
}

function toInvoiceItem(
  nihiiHealthcareProvider: string,
  patientDto: PatientDto,
  invoiceDto: InvoiceDto,
  invoicingCode: InvoicingCodeDto
): InvoiceItem {
  const invoiceItem = new InvoiceItem({})
  invoiceItem.codeNomenclature = Number(invoicingCode.tarificationId!!.split("|")[1])
  invoiceItem.dateCode = dateEncode(toMoment(invoicingCode.dateCode!!)!!.toDate())
  invoiceItem.doctorIdentificationNumber = nihiiHealthcareProvider
  invoiceItem.doctorSupplement = Number(((invoicingCode.doctorSupplement || 0) * 100).toFixed(0))
  if (invoicingCode.eidReadingHour && invoicingCode.eidReadingValue) {
    invoiceItem.eidItem = new EIDItem({
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
  invoiceItem.invoiceRef = uuidBase36(invoicingCode.id!!)

  invoiceItem.override3rdPayerCode = invoicingCode.override3rdPayerCode
  invoiceItem.patientFee = Number(((invoicingCode.patientIntervention || 0) * 100).toFixed(0))
  invoiceItem.percentNorm = InvoiceItem.PercentNormEnum.None
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

  return invoiceItem
}

function getSideCode(code: number) {
  return code === 0
    ? InvoiceItem.SideCodeEnum.None
    : code === 1
      ? InvoiceItem.SideCodeEnum.Left
      : code === 2
        ? InvoiceItem.SideCodeEnum.Right
        : InvoiceItem.SideCodeEnum.None
}

function getTimeOfDay(code: number) {
  return code === 0
    ? InvoiceItem.TimeOfDayEnum.Other
    : code === 1
      ? InvoiceItem.TimeOfDayEnum.Night
      : code === 2
        ? InvoiceItem.TimeOfDayEnum.Weekend
        : code === 3
          ? InvoiceItem.TimeOfDayEnum.Bankholiday
          : code === 4
            ? InvoiceItem.TimeOfDayEnum.Urgent
            : InvoiceItem.TimeOfDayEnum.Other
}

function getPrescriberNorm(code: number) {
  return code === 0
    ? InvoiceItem.PrescriberNormEnum.None
    : code === 1
      ? InvoiceItem.PrescriberNormEnum.OnePrescriber
      : code === 3
        ? InvoiceItem.PrescriberNormEnum.SelfPrescriber
        : code === 4
          ? InvoiceItem.PrescriberNormEnum.AddedCode
          : code === 9
            ? InvoiceItem.PrescriberNormEnum.ManyPrescribers
            : InvoiceItem.PrescriberNormEnum.None
}

export function getDerogationMaxNumber(code: number): InvoiceItem.DerogationMaxNumberEnum {
  return code === 0
    ? InvoiceItem.DerogationMaxNumberEnum.Other
    : code === 1
      ? InvoiceItem.DerogationMaxNumberEnum.DerogationMaxNumber
      : code === 2
        ? InvoiceItem.DerogationMaxNumberEnum.OtherPrescription
        : code === 3
          ? InvoiceItem.DerogationMaxNumberEnum.SecondPrestationOfDay
          : InvoiceItem.DerogationMaxNumberEnum.ThirdAndNextPrestationOfDay
}

export function toDerogationMaxNumber(derogation: InvoiceItem.DerogationMaxNumberEnum): number {
  return derogation === InvoiceItem.DerogationMaxNumberEnum.Other
    ? 0
    : derogation === InvoiceItem.DerogationMaxNumberEnum.DerogationMaxNumber
      ? 1
      : derogation === InvoiceItem.DerogationMaxNumberEnum.OtherPrescription
        ? 2
        : derogation === InvoiceItem.DerogationMaxNumberEnum.SecondPrestationOfDay
          ? 3
          : 4
}

export function uuidBase36(uuid: string): string {
  return base36UUID.encode(uuid)
}

/**
 * This function encodes an uuid in 13 characters in base36, this is
 * for the fileRef in efact, zone 303
 */
export function uuidBase36Half(uuid: string): string {
  const rawEndcode = base36UUID.encode(uuid.substr(0, 18))
  return _.padStart(rawEndcode, 13, "0")
}

export function decodeBase36Uuid(base36: string): string | null {
  try {
    const decoded: string = base36UUID.decode(base36)
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
