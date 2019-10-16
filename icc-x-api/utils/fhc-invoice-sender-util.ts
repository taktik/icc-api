import { HealthcarePartyDto } from "../../icc-api/model/models"
import { InvoiceSender } from "fhc-api"
import { getPhoneNumber } from "./hcp-util"

export function toInvoiceSender(hcp: HealthcarePartyDto, fedCode: string) {
  const phoneNumber = getPhoneNumber(hcp, 10) || 484082978

  if (!phoneNumber) {
    throw new Error("NO_PHONE_NUMBER_IN_HCP")
  }

  const fi =
    hcp.financialInstitutionInformation &&
    (hcp.financialInstitutionInformation.find(fii => fii.key === fedCode) ||
      hcp.financialInstitutionInformation[0])
  const bic = hcp.bic || (fi && fi.bic)
  const iban = hcp.bankAccount || (fi && fi.bankAccount)

  if (!bic || !iban) {
    throw new Error("Missing bic or iban for HCP")
  }

  const invoiceSender: InvoiceSender = {
    bce: Number(hcp.cbe),
    bic: bic!.replace(/ /g, ""),
    conventionCode: hcp.convention,
    firstName: hcp.firstName,
    iban: iban!.replace(/ /g, ""),
    lastName: hcp.lastName,
    nihii: Number(hcp.nihii),
    phoneNumber: phoneNumber,
    ssin: hcp.ssin
  }

  return invoiceSender
}
