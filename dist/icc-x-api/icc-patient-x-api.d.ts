import { iccPatientApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccFormXApi } from "./icc-form-x-api"
import { IccHcpartyXApi } from "./icc-hcparty-x-api"
import { IccInvoiceXApi } from "./icc-invoice-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"
import { IccHelementXApi } from "./icc-helement-x-api"
import { IccClassificationXApi } from "./icc-classification-x-api"
import * as models from "../icc-api/model/models"
import { IccCalendarItemXApi } from "./icc-calendar-item-x-api"
export declare class IccPatientXApi extends iccPatientApi {
  crypto: IccCryptoXApi
  contactApi: IccContactXApi
  formApi: IccFormXApi
  helementApi: IccHelementXApi
  invoiceApi: IccInvoiceXApi
  hcpartyApi: IccHcpartyXApi
  documentApi: IccDocumentXApi
  classificationApi: IccClassificationXApi
  calendarItemApi: IccCalendarItemXApi
  private cryptedKeys
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    contactApi: IccContactXApi,
    formApi: IccFormXApi,
    helementApi: IccHelementXApi,
    invoiceApi: IccInvoiceXApi,
    documentApi: IccDocumentXApi,
    hcpartyApi: IccHcpartyXApi,
    classificationApi: IccClassificationXApi,
    calendarItemaApi: IccCalendarItemXApi,
    cryptedKeys?: Array<string>,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(user: models.UserDto, p: any): Promise<models.PatientDto>
  initDelegations(
    patient: models.PatientDto,
    user: models.UserDto,
    secretForeignKey?: string
  ): Promise<models.PatientDto>
  initConfidentialDelegation(
    patient: models.PatientDto,
    user: models.UserDto
  ): Promise<models.PatientDto | null>
  createPatient(body?: models.PatientDto): never
  createPatientWithUser(
    user: models.UserDto,
    body?: models.PatientDto
  ): Promise<models.PatientDto | any>
  filterBy(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    body?: models.FilterChain
  ): never
  filterByWithUser(
    user: models.UserDto,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    body?: models.FilterChain
  ): Promise<models.PatientPaginatedList | any>
  findByAccessLogUserAfterDate(
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): never
  findByAccessLogUserAfterDateWithUser(
    user: models.UserDto,
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PatientPaginatedList | any>
  findByAccessLogUserAfterDate_1(externalId: string): never
  findByExternalIdWithUser(
    user: models.UserDto,
    externalId: string
  ): Promise<models.PatientDto | any>
  findByNameBirthSsinAuto(
    healthcarePartyId?: string,
    filterValue?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never
  findByNameBirthSsinAutoWithUser(
    user: models.UserDto,
    healthcarePartyId?: string,
    filterValue?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any>
  fuzzySearch(firstName?: string, lastName?: string, dateOfBirth?: number): never
  fuzzySearchWithUser(
    user: models.UserDto,
    firstName?: string,
    lastName?: string,
    dateOfBirth?: number
  ): Promise<Array<models.PatientDto> | any>
  getPatient(patientId: string): never
  getPatientRaw(patientId: string): Promise<models.PatientDto | any>
  getPatientWithUser(user: models.UserDto, patientId: string): Promise<models.PatientDto | any>
  getPatients(body?: models.ListOfIdsDto): never
  getPatientsWithUser(
    user: models.UserDto,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.PatientDto> | any>
  listDeletedPatients(
    startDate?: number,
    endDate?: number,
    desc?: boolean,
    startDocumentId?: string,
    limit?: number
  ): never
  listDeletedPatientsWithUser(
    user: models.UserDto,
    startDate?: number,
    endDate?: number,
    desc?: boolean,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PatientPaginatedList | any>
  listDeletedPatients_2(firstName?: string, lastName?: string): never
  listDeletedPatientsByNameWithUser(
    user: models.UserDto,
    firstName?: string,
    lastName?: string
  ): Promise<Array<models.PatientPaginatedList> | any>
  listOfMergesAfter(date: number): never
  listOfMergesAfterWithUser(
    user: models.UserDto,
    date: number
  ): Promise<Array<models.PatientDto> | any>
  listOfPatientsModifiedAfter(
    date: number,
    startKey?: number,
    startDocumentId?: string,
    limit?: number
  ): never
  listOfPatientsModifiedAfterWithUser(
    user: models.UserDto,
    date: number,
    startKey?: number,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PatientPaginatedList | any>
  listPatients(
    hcPartyId?: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never
  listPatientsWithUser(
    user: models.UserDto,
    hcPartyId?: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any>
  listPatientsByHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never
  listPatientsByHcPartyWithUser(
    user: models.UserDto,
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any>
  listPatientsOfHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never
  listPatientsOfHcPartyWithUser(
    user: models.UserDto,
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any>
  mergeInto(toId: string, fromIds: string): never
  mergeIntoWithUser(
    user: models.UserDto,
    toId: string,
    fromIds: string
  ): Promise<models.PatientDto | any>
  modifyPatient(body?: models.PatientDto): never
  modifyPatientRaw(body?: models.PatientDto): Promise<models.PatientDto | any>
  modifyPatientWithUser(
    user: models.UserDto,
    body?: models.PatientDto
  ): Promise<models.PatientDto | null>
  modifyPatientReferral(patientId: string, referralId: string, start?: number, end?: number): never
  modifyPatientReferralWithUser(
    user: models.UserDto,
    patientId: string,
    referralId: string,
    start?: number,
    end?: number
  ): Promise<models.PatientDto | any>
  encrypt(user: models.UserDto, pats: Array<models.PatientDto>): Promise<Array<models.PatientDto>>
  decrypt(
    user: models.UserDto,
    pats: Array<models.PatientDto>,
    fillDelegations?: boolean
  ): Promise<Array<models.PatientDto>>
  initEncryptionKeys(
    user: models.UserDto,
    pat: models.PatientDto
  ): Promise<
    models.PatientDto & {
      encryptionKeys: any
    }
  >
  share(
    user: models.UserDto,
    patId: string,
    ownerId: string,
    delegateIds: Array<string>,
    delegationTags: {
      [key: string]: Array<string>
    }
  ): Promise<{
    patient: models.PatientDto | null
    statuses: {
      [key: string]: {
        success: boolean | null
        error: Error | null
      }
    }
  } | null>
  checkInami(inami: String): Boolean
  isValidSsin(ssin: string): boolean
  getPatientIdOfChildDocumentForHcpAndHcpParents(
    childDocument: models.InvoiceDto | models.CalendarItemDto | models.ContactDto,
    hcpId: string
  ): Promise<string>
}
