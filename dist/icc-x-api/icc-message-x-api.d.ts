import { iccEntityrefApi, iccInsuranceApi, iccMessageApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"
import { IccInvoiceXApi } from "./icc-invoice-x-api"
import * as models from "../icc-api/model/models"
import {
  HealthcarePartyDto,
  InsuranceDto,
  InvoiceDto,
  MessageDto,
  ReceiptDto,
  UserDto
} from "../icc-api/model/models"
import { InvoiceWithPatient } from "./utils/efact-util"
import { fhcEfactcontrollerApi, EfactSendResponse } from "fhc-api"
import { EfactMessage } from "fhc-api"
import { ErrorDetail } from "fhc-api"
import { IccReceiptXApi } from "./icc-receipt-x-api"
import { DmgsList } from "fhc-api"
import { IccPatientXApi } from "./icc-patient-x-api"
import { GenAsyncResponse } from "fhc-api"
declare class EfactSendResponseWithError extends EfactSendResponse {
  error: string | undefined
  constructor(json: JSON)
}
export declare class IccMessageXApi extends iccMessageApi {
  private crypto
  private insuranceApi
  private entityReferenceApi
  private receiptXApi
  private invoiceXApi
  private documentXApi
  private patientApi
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    insuranceApi: iccInsuranceApi,
    entityReferenceApi: iccEntityrefApi,
    invoiceXApi: IccInvoiceXApi,
    documentXApi: IccDocumentXApi,
    receiptXApi: IccReceiptXApi,
    patientApi: IccPatientXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(user: models.UserDto, m: any): Promise<any>
  newInstanceWithPatient(
    user: models.UserDto,
    patient: models.PatientDto | null,
    m: any
  ): Promise<any>
  saveDmgsListRequest(
    user: models.UserDto,
    req: GenAsyncResponse,
    requestDate?: number
  ): Promise<MessageDto>
  processDmgMessagesList(
    user: UserDto,
    hcp: HealthcarePartyDto,
    list: DmgsList,
    docXApi: IccDocumentXApi
  ): Promise<Array<Array<string>>>
  private makeHcp
  private saveMessageInDb
  saveDmgListRequestInDb(
    user: UserDto,
    tack: string,
    resultMajor: string,
    appliesTo: string,
    hcp: HealthcarePartyDto,
    date?: Date,
    inss?: string
  ): Promise<any>
  extractErrorMessage(error?: ErrorDetail): string | undefined
  extractErrors(parsedRecords: any): string[]
  processTack(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage
  ): Promise<ReceiptDto>
  processEfactMessage(
    user: UserDto,
    hcp: HealthcarePartyDto,
    efactMessage: EfactMessage,
    invoicePrefix?: string,
    invoicePrefixer?: (invoice: InvoiceDto, hcpId: string) => Promise<string>
  ): Promise<{
    message: MessageDto
    invoices: Array<InvoiceDto>
  }>
  sendBatch(
    user: UserDto,
    hcp: HealthcarePartyDto,
    invoices: Array<InvoiceWithPatient>,
    xFHCKeystoreId: string,
    xFHCTokenId: string,
    xFHCPassPhrase: string,
    efactApi: fhcEfactcontrollerApi,
    fhcServer?: string | undefined,
    prefixer?: (fed: InsuranceDto, hcpId: string) => Promise<string>,
    isConnectedAsPmg?: boolean,
    medicalLocationId?: string
  ): Promise<models.MessageDto>
  saveMessageAttachment(
    user: UserDto,
    msg: MessageDto,
    res: EfactSendResponseWithError
  ): Promise<any>
}
export {}
