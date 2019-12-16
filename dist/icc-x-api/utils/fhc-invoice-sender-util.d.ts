import { HealthcarePartyDto } from "../../icc-api/model/models"
import { InvoiceSender } from "fhc-api"
export declare function toInvoiceSender(hcp: HealthcarePartyDto, fedCode: string): InvoiceSender
