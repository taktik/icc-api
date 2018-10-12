import { HealthcarePartyDto } from "../../icc-api/model/models"
import { InvoiceSender } from "fhc-api/dist/model/models"
import { getPhoneNumber } from "./hcp-util"

export function toInvoiceSender(hcp: HealthcarePartyDto) {
  const phoneNumber = getPhoneNumber(hcp) || 484082978

  if (!phoneNumber) {
    throw new Error("NO_PHONE_NUMBER_IN_HCP")
  }

  const invoiceSender: InvoiceSender = {
    bce: Number(hcp.cbe),
    bic: hcp.bic,
    conventionCode: hcp.convention,
    firstName: hcp.firstName,
    iban: hcp.bankAccount,
    lastName: hcp.lastName,
    nihii: Number(hcp.nihii),
    phoneNumber: phoneNumber,
    ssin: hcp.ssin
  }

  return invoiceSender
}
