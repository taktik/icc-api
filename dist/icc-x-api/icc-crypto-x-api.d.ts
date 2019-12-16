import { iccHcpartyApi, iccPatientApi } from "../icc-api/iccApi"
import { AESUtils } from "./crypto/AES"
import { RSAUtils } from "./crypto/RSA"
import { UtilsClass } from "./crypto/utils"
import { ShamirClass } from "./crypto/shamir"
import * as models from "../icc-api/model/models"
import { HealthcarePartyDto } from "../icc-api/model/models"
export declare class IccCryptoXApi {
  readonly shamir: ShamirClass
  readonly utils: UtilsClass
  readonly RSA: RSAUtils
  readonly AES: AESUtils
  hcPartyKeysCache: {
    [key: string]: {
      delegatorId: string
      key: CryptoKey
    }
  }
  hcPartiesRequestsCache: {
    [key: string]:
      | {
          entityType: null
          entity: Promise<models.HealthcarePartyDto | models.PatientDto>
        }
      | {
          entityType: "hcp"
          entity: Promise<models.HealthcarePartyDto>
        }
      | {
          entityType: "patient"
          entity: Promise<models.PatientDto>
        }
  }
  hcPartyKeysRequestsCache: {
    [delegateId: string]: Promise<{
      [delegatorId: string]: string
    }>
  }
  emptyHcpCache(hcpartyId: string): void
  private getHcpOrPatient
  private getCachedHcpOrPatientType
  /**
   * Gets all delegate encrypted HcParty keys of the delegate with the given `delegateHcPartyId`, and for each key the delegator id
   * If the keys are not cached, they are retrieved from the backend.
   *
   * @param delegateHcPartyId The Health Care Party id
   * @returns  \{delegatorId: delegateEncryptedHcPartyKey\}
   */
  private getHcPartyKeysForDelegate
  private forceGetHcPartyKeysForDelegate
  keychainLocalStoreIdPrefix: String
  hcpPreferenceKeyEhealthCert: string
  private hcpartyBaseApi
  private patientBaseApi
  private crypto
  private _AES
  private _RSA
  private _utils
  private _shamir
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    hcpartyBaseApi: iccHcpartyApi,
    patientBaseApi: iccPatientApi,
    crypto?: Crypto
  )
  randomUuid(): string
  encryptedShamirRSAKey(
    hcp: HealthcarePartyDto,
    notaries: Array<HealthcarePartyDto>,
    threshold: number
  ): Promise<Map<String, String>>
  /**
   * Gets the decryptedHcPartyKey for the given `encryptedHcPartyKey`
   *
   * If the decrypted key exists in the cache, retrieves it from there.
   * Otherwise, decrypts it using the RSA key of the delegator or delegate (depending on the value of `encryptedForDelegator`)
   * @param delegatorId : the id of the delegator HcP
   * @param delegateHcPartyId : the id of the delegate HcP
   * @param encryptedHcPartyKey : can be delegatorEncryptedHcPartyKey or delegateEncryptedHcPartyKey (depending on the value of `encryptedForDelegator`)
   * @param encryptedForDelegator : default false - for the `encryptedHcPartyKey` RSA encrypted for delegate; true for the `encryptedHcPartyKey` RSA encrypted for delegator;
   * @returns - **delegatorId** the input param  `delegatorId`
   * - **key** the decrypted `encryptedHcPartyKey`
   */
  decryptHcPartyKey(
    delegatorId: string,
    delegateHcPartyId: string,
    encryptedHcPartyKey: string,
    encryptedForDelegator?: boolean
  ): Promise<{
    delegatorId: string
    key: CryptoKey
  }>
  /**
   * Cache the RSA private/public key pair for the HcP with the given id `hcPartyKeyOwner`
   */
  cacheKeyPair(
    keyPairInJwk: {
      publicKey: JsonWebKey | ArrayBuffer
      privateKey: JsonWebKey | ArrayBuffer
    },
    hcPartyKeyOwner: string
  ): Promise<{
    publicKey: CryptoKey
    privateKey: CryptoKey
  }>
  /**
   * Gets the secret ID (SFKs) that should be used in the prescribed context (condfidential or not) from decrypted SPKs of the given `parent`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param parent : the object of which delegations (SPKs) to decrypt
   * @param hcpartyId : the id of the delegate HcP
   * @param confidential : wether the key is going to be used for a confidential piece or data or not
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  extractPreferredSfk(
    parent: models.PatientDto | models.MessageDto,
    hcpartyId: string,
    confidential: boolean
  ): Promise<string | null>
  /**
   * Gets an array of decrypted HcPartyKeys, shared between the delegate with ID `delegateHcPartyId` and the delegators in `delegatorsHcPartyIdsSet`
   *
   * 1. Get the keys for the delegateHealthCareParty (cache/backend).
   * 2. For each key in the delegators, decrypt it with the delegate's private key
   * 3. Filter out undefined keys and return th
   *
   * @param delegatorsHcPartyIdsSet array of delegator HcP IDs that could have delegated something to the HcP with ID `delegateHcPartyId`
   * @param delegateHcPartyId the HcP for which the HcPs with IDs in `delegatorsHcPartyIdsSet` could have delegated something
   * @returns - **delegatorId** : the id of the delegator HcP that shares the **key** with the `delegateHcPartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `delegateHcPartyId`
   */
  decryptAndImportAesHcPartyKeysForDelegators(
    delegatorsHcPartyIdsSet: Array<string>,
    delegateHcPartyId: string
  ): Promise<
    Array<{
      delegatorId: string
      key: CryptoKey
    }>
  >
  /**
   * Gets an array of decrypted HcPartyKeys from the given `delegations`, that are shared with / can be decrypted by the HcP with the given `healthcarePartyId` (or by its parents when `fallbackOnParent` is true)
   *
   * 1. Checks whether the delegations' object has a delegation for the
   * given healthCarePartyId.
   * 2. Enumerates all the delegators (delegation.owner) present in
   * the delegations.
   * 3. Decrypt's delegators' keys and returns them.
   *
   * @param healthcarePartyId : the id of the delegate HCP
   * @param delegations : generic delegations (can be SPKs, CFKs, EKs) for all delegates
   * @param fallbackOnParent  default true; use parent's healthCarePartyId in case there's no delegation for the `healthcarePartyId`
   * @returns  - **delegatorId** : the id of the delegator HcP that shares the **key** with the `healthcarePartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `healthcarePartyId`
   */
  decryptAndImportAesHcPartyKeysInDelegations(
    healthcarePartyId: string,
    delegations: {
      [key: string]: Array<models.DelegationDto>
    },
    fallbackOnParent?: boolean
  ): Promise<
    Array<{
      delegatorId: string
      key: CryptoKey
    }>
  >
  /**
   * Retreive the owner HealthCareParty key and use it to encrypt
   * both the delegations (createdObject.id) and the cryptedForeignKeys
   * (parentObject.id), and returns them in an object.
   */
  initObjectDelegations(
    createdObject: any,
    parentObject: any,
    ownerId: string,
    secretForeignKeyOfParent: string | null
  ): Promise<{
    delegations: any
    cryptedForeignKeys: any
    secretForeignKeys: any[]
    secretId: string
  }>
  /**
   * Gets updated instances of SPKs and CKFs for the child object `modifiedObject`.
   * These updated SPKs and CKFs contain new SPKs/CFKs to provide delegation from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`
   *
   * 1. if `secretIdOfModifiedObject` is not provided, the method will throw an exception; this `secretIdOfModifiedObject` is used to generate a new delegation (SPK) in step 3;
   *  the `secretIdOfModifiedObject` is returned, unmodified, as `secretId`
   * 2. if the owner (delegator) did not perform a delegation to the delegate, then this HcP delegation (creation of a new HcPKey) is performed now
   * 3. creates a new delegation (Secret Primary Keys) on the `modifiedObject` encrypted with the HcPKey from owner to the delegate;
   * 4. if `parentObject` != null, creates a new CFK on the `modifiedObject` encrypted with the HcPKey from owner to the delegate;
   * 5. this new delegation (from step 3) is added to the list of existing delegations (Secret Primary Keys) on the `modifiedObject` for the delegate given by `delegateId`
   * 6. if the CFK (from step 4) can be created, this new CFK is added to the list of existing CFKs on the `modifiedObject` for the delegate given by `delegateId`
   * 7. then some duplicates delegations (SPKs) and CKFs are removed
   *
   * @param modifiedObject : the object of which SPKs and CFKs will be cloned, the clones will be modified and then used as returned values ; it's a 'child' of `parentObject`; will NOT be mutated
   * @param parentObject : will NOT be mutated
   * @param ownerId : the HcP id of the delegator
   * @param delegateId : the HcP id of the delegate
   * @param secretIdOfModifiedObject : the secret id used in the child object to generate its SPK
   * @returns - **delegations**  existing delegations (SPKs) of the `modifiedObject`, appended with results from step 5
   * - **cryptedForeignKeys** existing CFKs of the `modifiedObject`, appended with results from steps 6
   * - **secretId** which is the given input parameter `secretIdOfModifiedObject`
   */
  extendedDelegationsAndCryptedForeignKeys(
    modifiedObject: any | null,
    parentObject: any | null,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string | null
  ): Promise<{
    delegations: {
      [key: string]: Array<models.DelegationDto>
    }
    cryptedForeignKeys: {
      [key: string]: Array<models.DelegationDto>
    }
    secretId: string | null
  }>
  /**
   * Retrieve the owners HealthCareParty key, decrypt it, and
   * use it to encrypt & initialize the "encryptionKeys" object
   * and return it.
   * @param createdObject
   * @param ownerId
   */
  initEncryptionKeys(
    createdObject: any,
    ownerId: string
  ): Promise<{
    encryptionKeys: any
    secretId: string
  }>
  /**
   * Gets an updated instance of the EKs of `modifiedObject`.
   * The updated EKs contain a new EK to provide delegation from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`.
   * @param modifiedObject : the object of which EKs will be cloned, the clone will be used to append the new EK, and then used as return value; will NOT be mutated
   * @param ownerId : delegator HcP id
   * @param delegateId : delegate HcP id
   * @param secretEncryptionKeyOfObject : secret Id for the EK (Content Encryption Key)
   * @returns - **encryptionKeys** existing EKs of the `modifiedObject`, appended with a new EK item (owner: `ownerId`, delegatedTo: `delegateId`, encrypted key with secretId: `secretEncryptionKeyOfObject` )
   * - **secretId** which is the given input parameter `secretEncryptionKeyOfObject`
   */
  appendEncryptionKeys(
    modifiedObject: any,
    ownerId: string,
    delegateId: string,
    secretEncryptionKeyOfObject: string
  ): Promise<{
    encryptionKeys: {
      [key: string]: Array<models.DelegationDto>
    }
    secretId: string | null
  }>
  /**
   * Gets an updated `child` object that will have its SPKs, CFKs, KSs updated to include delegations from delegator HcP with id `ownerId` to delegate HcP with id `delegateId`
   * The SFKs of `child` are not updated, so this method assumes this is not the initial delegation on the `child` object
   * The method also performs some deduplication of all types of delegations.
   * @param parent : the parent object of `child`; will NOT be mutated
   * @param child : the object that will be mutated and returned
   * @param ownerId delegator HcP id
   * @param delegateId delegate HcP id
   * @param secretDelegationKey  the secret Id used in the child object to generate the SPK
   * @param secretEncryptionKey  the secret Id used in the child object to generate the EK (Content Encryption Key)
   * @returns - an updated `child` object that will contain updated SPKs, CFKs, EKs
   *  */
  addDelegationsAndEncryptionKeys(
    parent: models.PatientDto | models.MessageDto | null,
    child:
      | models.PatientDto
      | models.ContactDto
      | models.InvoiceDto
      | models.DocumentDto
      | models.HealthElementDto
      | models.ReceiptDto,
    ownerId: string,
    delegateId: string,
    secretDelegationKey: string,
    secretEncryptionKey: string | null
  ): Promise<
    | models.PatientDto
    | models.ContactDto
    | models.InvoiceDto
    | models.DocumentDto
    | models.HealthElementDto
    | models.ReceiptDto
  >
  /**
   * Gets the secret IDs (SFKs) inside decrypted SPKs of the given `document`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param document : the object of which delegations (SPKs) to decrypt
   * @param hcpartyId : the id of the delegate HcP
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  extractDelegationsSFKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto
      | models.ReceiptDto
      | models.ClassificationDto
      | models.CalendarItemDto
      | null,
    hcpartyId?: string
  ): Promise<{
    extractedKeys: Array<string>
    hcpartyId?: string
  }>
  /**
   * Gets the secret IDs (SFKs) inside decrypted SPKs of the given `document`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param document : the object of which delegations (SPKs) to decrypt
   * @param hcpartyId : the id of the delegate HcP
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  extractSFKsHierarchyFromDelegations(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto
      | models.ReceiptDto
      | models.ClassificationDto
      | models.CalendarItemDto
      | null,
    hcpartyId?: string
  ): Promise<
    Array<{
      hcpartyId: string
      extractedKeys: Array<string>
    }>
  >
  extractCryptedFKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto
      | models.ReceiptDto
      | models.CalendarItemDto
      | models.ClassificationDto
      | null,
    hcpartyId: string
  ): Promise<{
    extractedKeys: Array<string>
    hcpartyId: string
  }>
  extractEncryptionsSKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.ReceiptDto
      | models.HealthElementDto
      | models.ClassificationDto,
    hcpartyId: string
  ): Promise<{
    extractedKeys: Array<string>
    hcpartyId: string
  }>
  extractDelegationsSFKsAndEncryptionSKs(
    ety:
      | models.PatientDto
      | models.ContactDto
      | models.InvoiceDto
      | models.DocumentDto
      | models.HealthElementDto,
    ownerId: string
  ): Promise<[string[], string[]]>
  /**
   * Get decrypted generic secret IDs (secretIdSPKs, parentIds, secretIdEKs) from generic delegations (SPKs, CFKs, EKs)
   * 1. Get HealthCarePartyDto from it's Id.
   * 2. Decrypt the keys of the given HCP.
   * 3. Decrypt the parent's key if it has parent.
   * 4. Return the decrypted key corresponding to the Health Care Party.
   * @param hcpartyId : the id of the delegate HcP (including its parents) for which to decrypt `extractedKeys`
   * @param objectId : the id of the object/document of which delegations to decrypt ; used just to log to console a message (Cryptographic mistake) in case the object id inside SPK, CFK, EK is different from this one
   * @param delegations : generic delegations (can be SPKs, CFKs, EKs) for all delegates from where to extract `extractedKeys`
   * @returns - **extractedKeys** array containing secret IDs from decrypted generic delegations, from both HCP with given `hcpartyId` and its parents; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HCP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  extractKeysHierarchyFromDelegationLikes(
    hcpartyId: string,
    objectId: string,
    delegations: {
      [key: string]: Array<models.DelegationDto>
    }
  ): Promise<
    Array<{
      hcpartyId: string
      extractedKeys: Array<string>
    }>
  >
  /**
   * Get decrypted generic secret IDs (secretIdSPKs, parentIds, secretIdEKs) from generic delegations (SPKs, CFKs, EKs)
   * 1. Get HealthCarePartyDto from it's Id.
   * 2. Decrypt the keys of the given HCP.
   * 3. Decrypt the parent's key if it has parent.
   * 4. Return the decrypted key corresponding to the Health Care Party.
   * @param hcpartyId : the id of the delegate HcP (including its parents) for which to decrypt `extractedKeys`
   * @param objectId : the id of the object/document of which delegations to decrypt ; used just to log to console a message (Cryptographic mistake) in case the object id inside SPK, CFK, EK is different from this one
   * @param delegations : generic delegations (can be SPKs, CFKs, EKs) for all delegates from where to extract `extractedKeys`
   * @returns - **extractedKeys** array containing secret IDs from decrypted generic delegations, from both HCP with given `hcpartyId` and its parents; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HCP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  extractKeysFromDelegationsForHcpHierarchy(
    hcpartyId: string,
    objectId: string,
    delegations: {
      [key: string]: Array<models.DelegationDto>
    }
  ): Promise<{
    extractedKeys: Array<string>
    hcpartyId: string
  }>
  /**
   * Gets an array of generic secret IDs decrypted from a list of generic delegations (SPKs, CFKs, EKs) `delegationsArray`
   * If a particular generic delegation thows an exception when decrypted, the return value for it's secret ID will be 'false' and a message is logged to console
   * For each one of the delegations in the `delegationsArray`, it tries to decrypt with the decryptedHcPartyKey of the owner of that delegation;
   *
   * @param delegationsArray : generic delegations array
   * @param aesKeys : **key** HcP ids of delegators/owners in the `delegationsArray`, each with its own decryptedHcPartyKey
   * @param masterId : is the object id to which the generic delegation belongs to
   * - used only to check whether the object.id matches the one stored in the decrypted generic delegation item
   * - even if there's no match, the secret ID is kept as a valid result (and a message logged to console)
   * @returns array of generic secret IDs (secretIdSPK, parentId, secretIdEK)
   */
  decryptKeyInDelegationLikes(
    delegationsArray: Array<models.DelegationDto>,
    aesKeys: {
      [key: string]: CryptoKey
    },
    masterId: string
  ): Promise<Array<string>>
  loadKeyPairsAsTextInBrowserLocalStorage(
    healthcarePartyId: string,
    privateKey: Uint8Array
  ): Promise<void>
  loadKeyPairsAsJwkInBrowserLocalStorage(
    healthcarePartyId: string,
    privKey: JsonWebKey
  ): Promise<void>
  loadKeyPairsInBrowserLocalStorage(healthcarePartyId: string, file: Blob): Promise<{}>
  saveKeychainInBrowserLocalStorage(id: string, keychain: number): void
  saveKeychainInBrowserLocalStorageAsBase64(id: string, keyChainB64: string): void
  saveKeyChainInHCPFromLocalStorage(hcpId: string): Promise<HealthcarePartyDto>
  importKeychainInBrowserFromHCP(hcpId: string): Promise<void>
  /**
   * Returns true if a key has been set in the localstorage
   * @param hcpId The healthcare party id
   */
  syncEhealthCertificate(hcpId: string): Promise<boolean>
  getKeychainInBrowserLocalStorageAsBase64(id: string): string | null
  loadKeychainFromBrowserLocalStorage(id: String): Uint8Array[] | null
  generateKeyForDelegate(
    ownerId: string,
    delegateId: string
  ): Promise<models.HealthcarePartyDto | models.PatientDto>
  checkPrivateKeyValidity(hcp: models.HealthcarePartyDto | models.PatientDto): Promise<boolean>
  private throwDetailedExceptionForInvalidParameter
}
