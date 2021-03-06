/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { InvoiceItem } from "./InvoiceItem"
import { PatientDto } from "./PatientDto"

import { decodeBase64 } from "./ModelHelper"

export class Invoice {
  constructor(json: JSON | any) {
    Object.assign(this as Invoice, json)
  }

  patient?: PatientDto
  ioCode?: string
  items?: Array<InvoiceItem>
  reason?: Invoice.ReasonEnum
  invoiceRef?: string
  invoiceNumber?: number
  ignorePrescriptionDate?: boolean
  hospitalisedPatient?: boolean
  creditNote?: boolean
  relatedInvoiceIoCode?: string
  relatedInvoiceNumber?: number
  relatedBatchSendNumber?: number
  relatedBatchYearMonth?: number
}
export namespace Invoice {
  export type ReasonEnum =
    | "Chimiotherapy"
    | "ProfessionalDisease"
    | "WorkAccident"
    | "Accident"
    | "Other"
  export const ReasonEnum = {
    Chimiotherapy: "Chimiotherapy" as ReasonEnum,
    ProfessionalDisease: "ProfessionalDisease" as ReasonEnum,
    WorkAccident: "WorkAccident" as ReasonEnum,
    Accident: "Accident" as ReasonEnum,
    Other: "Other" as ReasonEnum
  }
}
