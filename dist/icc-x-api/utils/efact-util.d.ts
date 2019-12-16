import {
  HealthcarePartyDto,
  InsuranceDto,
  InvoiceDto,
  PatientDto
} from "../../icc-api/model/models"
import { IccInvoiceXApi, IccMessageXApi } from "../../icc-x-api"
import { iccInsuranceApi } from "../../icc-api/api/iccInsuranceApi"
import { InvoicesBatch, InvoiceItem } from "fhc-api"
export interface RelatedInvoiceInfo {
  invoiceId: string
  invoiceReference?: string
  sendNumber?: string
  insuranceCode?: string
  invoicingYear?: string
  invoicingMonth?: string
}
export interface InvoiceWithPatient {
  patientDto: PatientDto
  invoiceDto: InvoiceDto
  aggregatedInvoice?: InvoiceDto
}
export declare function getFederaton(
  invoices: Array<InvoiceWithPatient>,
  insuranceApi: iccInsuranceApi
): Promise<InsuranceDto>
export declare function getRelatedInvoicesInfo(
  invoicesWithPatient: InvoiceWithPatient[],
  insuranceApi: iccInsuranceApi,
  invoiceXApi: IccInvoiceXApi,
  messageXApi: IccMessageXApi
): Promise<RelatedInvoiceInfo[]>
export declare function toInvoiceBatch(
  invoicesWithPatient: Array<InvoiceWithPatient>,
  hcp: HealthcarePartyDto,
  batchRef: string,
  batchNumber: number,
  fileRef: string,
  insuranceApi: iccInsuranceApi,
  invoiceXApi: IccInvoiceXApi,
  messageXApi: IccMessageXApi
): Promise<InvoicesBatch>
export declare function getDerogationMaxNumber(code: number): InvoiceItem.DerogationMaxNumberEnum
export declare function toDerogationMaxNumber(
  derogation: InvoiceItem.DerogationMaxNumberEnum
): number
export declare function uuidBase36(uuid: string): string
/**
 * This function encodes an uuid in 13 characters in base36, this is
 * for the fileRef in efact, zone 303
 */
export declare function uuidBase36Half(uuid: string): string
export declare function decodeBase36Uuid(base36: string): string | null
