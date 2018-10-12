import {
  HealthcarePartyDto,
  InsuranceDto,
  InvoiceDto,
  InvoicingCodeDto,
  ListOfIdsDto,
  PatientDto
} from "../../../icc-api/model/models"

import { InvoicesBatch, InvoiceItem, Invoice, EIDItem } from "fhc-api/dist/model/models"
import { dateEncode } from "./formatting-util"
import { toPatient } from "./fhc-patient-util"
import { toInvoiceSender } from "./fhc-invoice-sender-util"
import { isPatientHospitalized, getMembership, getInsurability } from "./insurability-util"
import * as _ from "lodash"
import * as moment from "moment"
import { iccInsuranceApi } from "../../../icc-api/api/iccInsuranceApi"

export interface InvoiceWithPatient {
  invoiceDto: InvoiceDto
  patientDto: PatientDto
}

// Here we trust the invoices argument for grouping validity (month, year and patient)
export function toInvoiceBatch(
  invoices: Array<InvoiceWithPatient>,
  hcp: HealthcarePartyDto,
  batchRef: string,
  batchNumber: string,
  fileRef: string,
  insuranceApi: iccInsuranceApi
): Promise<InvoicesBatch> {
  return insuranceApi
    .getInsurances(
      new ListOfIdsDto(_.compact(invoices.map(iwp => getInsurability(iwp.patientDto).insuranceId)))
    )
    .then((insurances: Array<InsuranceDto>) => {
      return insuranceApi
        .getInsurances(new ListOfIdsDto(_.uniq(_.compact(insurances.map(i => i.parent)))))
        .then((parents: Array<InsuranceDto>) => {
          const fedCodes = _.compact(parents.map(i => i.code))
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
            const ins = insurances.find(
              i => i.id === getInsurability(invWithPat.patientDto).insuranceId
            )
            if (!ins) {
              throw "Insurance is invalid for patient " + invWithPat.patientDto.id
            }
            return toInvoice(hcp.nihii!!, invWithPat.invoiceDto, invWithPat.patientDto, ins)
          })
          invoicesBatch.invoicingMonth = moment(invoices[0].invoiceDto.invoiceDate).month() + 1
          invoicesBatch.invoicingYear = moment(invoices[0].invoiceDto.invoiceDate).year()
          invoicesBatch.ioFederationCode = fedCodes[0]
          invoicesBatch.numericalRef = Number.parseInt(batchNumber)
          invoicesBatch.sender = toInvoiceSender(hcp)
          invoicesBatch.uniqueSendNumber = Number.parseInt(batchNumber)

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
  invoice.invoiceRef = invoiceDto.invoiceReference || "0"
  invoice.ioCode = insurance.code
  invoice.items = _.map(invoiceDto.invoicingCodes, (invoicingCodeDto: InvoicingCodeDto) => {
    return toInvoiceItem(nihiiHealthcareProvider, patientDto, invoiceDto, invoicingCodeDto)
  })
  invoice.patient = toPatient(patientDto)
  // TODO : fix me later
  invoice.reason = Invoice.ReasonEnum.Other

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
  invoiceItem.dateCode = dateEncode(moment(invoicingCode.dateCode).toDate())
  invoiceItem.doctorIdentificationNumber = nihiiHealthcareProvider
  invoiceItem.doctorSupplement = invoicingCode.doctorSupplement
  if (invoicingCode.eidReadingHour && invoicingCode.eidReadingValue) {
    invoiceItem.eidItem = new EIDItem({
      deviceType: "1",
      readType: "1",
      readDate: invoiceItem.dateCode,
      readHour: invoicingCode.eidReadingHour,
      readValue: invoicingCode.eidReadingValue
    })
  }
  invoiceItem.gnotionNihii = invoiceDto.gnotionNihii
  invoiceItem.insuranceRef = getMembership(patientDto)
  invoiceItem.insuranceRefDate = getInsurability(patientDto).startDate
  invoiceItem.invoiceRef = invoiceDto.invoiceReference || "0"

  invoiceItem.override3rdPayerCode = invoicingCode.override3rdPayerCode
  invoiceItem.patientFee = invoicingCode.patientIntervention
  invoiceItem.percentNorm = InvoiceItem.PercentNormEnum.None
  invoiceItem.personalInterventionCoveredByThirdPartyCode =
    invoicingCode.cancelPatientInterventionReason
  invoiceItem.prescriberNihii = invoicingCode.prescriberNihii
  invoiceItem.prescriberNorm = getPrescriberNorm(invoicingCode.prescriberNorm || 0)
  invoiceItem.reimbursedAmount = invoicingCode.reimbursement
  invoiceItem.relatedCode = Number(invoicingCode.relatedCode)
  invoiceItem.sideCode = getSideCode(invoicingCode.side || 0)
  invoiceItem.timeOfDay = getTimeOfDay(invoicingCode.timeOfDay || 0)
  invoiceItem.units = invoicingCode.units

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
