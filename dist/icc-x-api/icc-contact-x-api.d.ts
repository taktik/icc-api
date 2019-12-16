import { iccContactApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "../icc-x-api/icc-crypto-x-api"
import * as models from "../icc-api/model/models"
import { ContactDto } from "../icc-api/model/models"
export declare class IccContactXApi extends iccContactApi {
  i18n: any
  crypto: IccCryptoXApi
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(
    user: models.UserDto,
    patient: models.PatientDto,
    c: any,
    confidential?: boolean
  ): Promise<models.ContactDto>
  /**
   * 1. Extract(decrypt) the patient's secretForeignKeys from the
   * "delegations" object.
   * 2. Initialize & encrypt the Contact's delegations & cryptedForeignKeys.
   * 3. Initialize & encrypt the Contact's encryptionKeys.
   * 4. Return the contact with the extended delegations, cryptedForeignKeys
   * & encryptionKeys.
   */
  private initDelegationsAndEncryptionKeys
  initEncryptionKeys(
    user: models.UserDto,
    ctc: models.ContactDto
  ): Promise<
    models.ContactDto & {
      encryptionKeys: any
    }
  >
  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all contacts with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the contacts of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   */
  findBy(hcpartyId: string, patient: models.PatientDto): Promise<any[]>
  findByPatientSFKs(
    hcpartyId: string,
    patients: Array<models.PatientDto>
  ): Promise<Array<models.ContactDto>>
  filterBy(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChain
  ): never
  listContactsByOpeningDate(
    startKey: number,
    endKey: number,
    hcpartyid: string,
    startDocumentId?: string,
    limit?: number
  ): never
  findByHCPartyFormId(hcPartyId?: string, formId?: string): never
  findByHCPartyFormIds(hcPartyId?: string, body?: models.ListOfIdsDto): never
  getContact(contactId: string): never
  getContacts(body?: models.ListOfIdsDto): never
  modifyContact(body?: ContactDto): never
  modifyContacts(body?: Array<ContactDto>): never
  createContact(body?: ContactDto): never
  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys?: string,
    planOfActionIds?: string,
    skipClosedContacts?: boolean
  ): Promise<Array<models.ContactDto> | any>
  filterByWithUser(
    user: models.UserDto,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChain
  ): Promise<models.ContactPaginatedList | any>
  listContactsByOpeningDateWithUser(
    user: models.UserDto,
    startKey: number,
    endKey: number,
    hcpartyid: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.ContactPaginatedList | any>
  findByHCPartyFormIdWithUser(
    user: models.UserDto,
    hcPartyId?: string,
    formId?: string
  ): Promise<Array<models.ContactDto> | any>
  findByHCPartyFormIdsWithUser(
    user: models.UserDto,
    hcPartyId?: string,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.ContactDto> | any>
  getContactWithUser(user: models.UserDto, contactId: string): Promise<models.ContactDto | any>
  getContactsWithUser(
    user: models.UserDto,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.ContactDto> | any>
  modifyContactWithUser(
    user: models.UserDto,
    body?: models.ContactDto
  ): Promise<models.ContactDto | any>
  modifyContactsWithUser(
    user: models.UserDto,
    bodies?: Array<models.ContactDto>
  ): Promise<models.ContactDto | any>
  createContactWithUser(
    user: models.UserDto,
    body?: models.ContactDto
  ): Promise<models.ContactDto | any>
  encrypt(user: models.UserDto, ctcs: Array<models.ContactDto>): Promise<models.ContactDto[]>
  decrypt(hcpartyId: string, ctcs: Array<models.ContactDto>): Promise<Array<models.ContactDto>>
  decryptServices(
    hcpartyId: string,
    svcs: Array<models.ServiceDto>
  ): Promise<Array<models.ContactDto>>
  contactOfService(ctcs: Array<models.ContactDto>, svcId: string): models.ContactDto | undefined
  filteredServices(ctcs: Array<models.ContactDto>, filter: any): Array<models.ServiceDto>
  filterServices(ctcs: Array<models.ContactDto>, filter: any): Promise<Array<models.ServiceDto>>
  services(ctc: models.ContactDto, label: string): models.ServiceDto[]
  preferredContent(svc: models.ServiceDto, lng: string): models.ContentDto | undefined
  contentValue(
    c: models.ContentDto
  ): string | number | boolean | models.MeasureDto | models.MedicationDto | undefined
  shortServiceDescription(svc: models.ServiceDto, lng: string): string | number
  shortContentDescription(c: models.ContentDto, lng: string, label?: string): string | number
  medicationValue(svc: models.ServiceDto, lng: string): models.MedicationDto | undefined
  contentHasData(c: any): boolean
  localize(e: any, lng: string): any
  /**
   * Modifies the subcontacts this svc belongs to while minimizing the number of references to the svcs inside the subcontacts
   * After the invocation, there is at least one subcontact with provided poaId and heId that contains the svc
   * The svc is not removed from a previous subcontact it would belong to except if the new conditions are compatible
   * Note that undefined and null do not have the same meaning for formId
   * If formId is null: the subcontact which refers svc must have a null formId
   * If formId is undefined, the subcontact can have any value for formId
   *
   * When a svc does not exist yet in the current contact but exists in a previous contact, all the scs it was belonging to are
   * copied in the current contact
   *
   * the svc returned is the one that's inside the ctc
   *
   * @param ctc
   * @param user
   * @param ctcs
   * @param svc
   * @param formId
   * @param poaId aMap {heId2: [poaId11, poaId12], heId2: [poaId21] }
   * @param heId an Array of heIds, equivalent to poaIds = {heId: [], ...}
   * @param init
   * @returns {*}
   */
  promoteServiceInContact(
    ctc: models.ContactDto,
    user: models.UserDto,
    ctcs: Array<models.ContactDto>,
    svc: models.ServiceDto,
    formId: string,
    poaIds?: {
      [key: string]: string[]
    },
    heIds?: Array<string>,
    init?: any
  ): any
  isNumeric(svc: models.ServiceDto, lng: string): number | boolean | models.MeasureDto | undefined
  service(): {
    newInstance: (user: models.UserDto, s: any) => any
  }
  medication(): {
    regimenScores: () => any
    medicationNameToString: (m: any) => string
    reimbursementReasonToString: (m: any, lang: string) => any
    medicationToString: (m: any, lang: string) => string
    productToString: (m: any) => string
    posologyToString: (m: any, lang: string) => any
    frequencyToString: (m: any, lang: string) => any
    durationToString: (d: models.DurationDto, lang: string) => string
    regimenToExtString: (r: models.RegimenItemDto, lang: string) => string
    regimenToString: (r: models.RegimenItemDto, lang: string) => string | null
    localize: (s: any, lang: string) => any
  }
}
