import { EfactMessage } from "fhc-api"
import { ErrorDetail } from "fhc-api"
import { Record } from "fhc-api"
export interface Zone200Data extends ETData {
  isTest: boolean
  hcpMessageRef: string
  mutualityMessageReference: string
}
export interface Zone300Data extends ETData {
  sendingNumber: string
  invoiceReference: string
  mutualityContactLastName: string
  mutualityContactFirstName: string
  mutualityContactPhoneNumber: string
  invoiceType: string
  invoiceMode: string
  errorPercentage: string
  invoiceRejectionType: string
}
export interface Zone300Short extends ETData {
  sendingNumber: string
  invoiceReference: string
  mutualityContactLastName: string
  mutualityContactFirstName: string
  mutualityContactPhoneNumber: string
  invoiceType: string
  invoiceMode: string
}
export interface Zone300Stub extends ETData {
  messageType: string
}
export interface Zone400Data {
  mutualityNumber: string
  signAmount1: string
  askedAmount1: string
  mutualityControlNumber: string
}
export interface Zone500Data {
  mutualityNumber: string
  signAmount1: string
  askedAmount1: string
  mutualityControlNumber: string
}
export interface ETData {
  errorDetail?: ErrorDetail
}
export interface ET10Data extends ETData {
  fileVersion: string
  financialAccountNumber1: string
  sendingNumber: string
  financialAccountNumber2: string
  deletionCodePaperInvoice: string
  thirdPartyNumber: string
  accreditationCinNumber: string
  invoicingYear: string
  invoicingMonth: string
  invoiceReference: string
  bic1: string
  iban1: string
  bic2: string
  iban2: string
  recordControlNumber: string
}
export interface ET20Data extends ETData {
  ct1ct2: string
  reference: string
  recipientIdentifierFlag: string
  previousInvoicingYearMonth: string
  insurabilityStartDate: string
  insurabilityEndDate: string
}
export interface ET50Data extends ETData {
  recordOrderNumber: string
  sex: string
  montantInterventionAssurance: string
  units: string
  prescriberNihii: string
  itemReference: string
  tooth: string
  thirdPartyException: string
  treatedMember: string
}
export interface ET51Data extends ETData {
  recordOrderNumber: string
  prestationCode: string
  prestationDate: string
  recipientIdentifier: string
  careProviderIdentifier: string
  reimbursementAmount: string
  ct1ct2: string
  networkReferenceData: string
  infoCommunicationDate: string
  recordControlNumber: string
}
export interface ET52Data extends ETData {
  recordOrderNumber: string
  nomenCode: string
  prestationDate: string
  eidDate: string
  patientINSS: string
  eidSupportType: string
  eidReadingType: string
  eidReadingHour: string
  nihii: string
}
export interface ET80Data extends ETData {
  recipientIdentifier: string
}
export interface ET90Data extends ETData {
  financialAccountNumber1: string
  sendingNumber: string
  financialAccountNumber2: string
  thirdPartyNumber: string
  signeAndTotalAmountCptA: string
  invoicingYear: string
  invoicingMonth: string
  invoiceReference: string
  cbe: string
  bic1: string
  iban1: string
  bic2: string
  iban2: string
  invoiceControlNumber: string
  recordControlNumber: string
}
export interface ET91Data {
  askedAmountForAccount1: string
  askedAmountForAccount2: string
  totalAskedAmount: string
  numberOfRecordBundle: string
  acceptedAmountAccount1: string
  rejectedAmountAccount1: string
  acceptedAmountAccount2: string
  rejectedAmountAccount2: string
  totalAcceptedAmount: string
  totalRejectedAmount: string
  paymentReferenceAccount1: string
  paymentReferenceAccount2: string
}
export interface ET92Data {
  askedAmountAccount1: string
  askedAmountAccount2: string
  totalAskedAmount: string
  numberOfRecord: string
  acceptedAmountAccount1: string
  rejectedAmountAccount1: string
  acceptedAmountAccount2: string
  rejectedAmountAccount2: string
  totalAcceptedAmount: string
  totalRejectedAmount: string
}
export interface ET20_80Data {
  et20: ET20Data
  items: Array<{
    et50?: ET50Data | undefined
    et51?: ET51Data | undefined
    et52?: ET52Data | undefined
  }>
  et80?: ET80Data
}
export interface File920900Data {
  zone200: Zone200Data
  zone300: Zone300Data
  et10: ET10Data
  records: Array<ET20_80Data>
  et90: ET90Data
  et91: Array<ET91Data>
  et92: ET92Data
}
export interface File931000Data {
  zone200: Zone200Data
}
export interface File920099Data {
  zone200: Zone200Data
  zone300: Zone300Data
  et10: ET10Data
  records: Array<ET20_80Data>
  et90: ET90Data
}
export interface File920098Data {
  zone200: Zone200Data
  zone300: Zone300Data
  et10: ET10Data
  records: Array<ET20_80Data>
  et90: ET90Data
}
export interface File920999Data {
  zone200: Zone200Data
  zone300: Zone300Short
  et95: Array<Zone400Data | undefined>
  et96: Zone500Data | undefined
}
export abstract class EfactMessageReader {
  message: EfactMessage
  abstract fileType: string
  private log
  constructor(message: EfactMessage, debug?: boolean)
  readonly xades: string | undefined
  readonly hashValue: string | undefined
  abstract read(): any
  readZone200(zone200: Record): Zone200Data
  readZone300(zone300: Record): Zone300Data
  readZone300Stub(zone300: Record): Zone300Stub
  readZone300Short(zone300: Record): Zone300Short
  readET10(et10: Record): ET10Data
  readET20(et20: Record): ET20Data
  readET50(et50: Record): ET50Data
  readET51(et51: Record): ET51Data
  readET52(et52: Record): ET52Data
  readET80(et80: Record): ET80Data
  readET90(et90: Record): ET90Data
  readET91(et91: Record): ET91Data
  readET92(et92: Record): ET92Data
  readZone400(zone400: Record): Zone400Data
  readZone500(zone500: Record): Zone500Data
}
export declare class EfactMessage920900Reader extends EfactMessageReader {
  fileType: string
  read(): File920900Data | undefined
}
export declare class EfactMessage931000Reader extends EfactMessageReader {
  fileType: string
  read(): File931000Data | undefined
}
export declare class EfactMessage920099Reader extends EfactMessageReader {
  fileType: string
  read(): File920099Data | undefined
}
export declare class EfactMessage920098Reader extends EfactMessageReader {
  fileType: string
  read(): File920098Data | undefined
}
export declare class EfactMessage920999Reader extends EfactMessageReader {
  fileType: string
  read(): File920999Data | undefined
}
