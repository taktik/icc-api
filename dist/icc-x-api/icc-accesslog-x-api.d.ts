import { iccAccesslogApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import * as models from "../icc-api/model/models"
export declare class IccAccesslogXApi extends iccAccesslogApi {
  crypto: IccCryptoXApi
  cryptedKeys: string[]
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(user: models.UserDto, patient: models.PatientDto, h: any): Promise<any>
  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all helements with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the helements of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   * @param keepObsoleteVersions
   */
  findBy(hcpartyId: string, patient: models.PatientDto): Promise<any>
  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys?: string
  ): Promise<Array<models.ContactDto> | any>
  decrypt(
    hcpId: string,
    accessLogs: Array<models.AccessLogDto>
  ): Promise<Array<models.AccessLogDto>>
  initEncryptionKeys(
    user: models.UserDto,
    accessLogDto: models.AccessLogDto
  ): Promise<
    models.AccessLogDto & {
      encryptionKeys: any
    }
  >
  encrypt(
    user: models.UserDto,
    accessLogs: Array<models.AccessLogDto>
  ): Promise<Array<models.AccessLogDto>>
  createAccessLog(body?: models.AccessLogDto): never
  createAccessLogWithUser(
    user: models.UserDto,
    body?: models.AccessLogDto
  ): Promise<models.AccessLogDto | any>
  getAccessLog(accessLogId: string): never
  getAccessLogWithUser(
    user: models.UserDto,
    accessLogId: string
  ): Promise<models.AccessLogDto | any>
  listAccessLogs(
    fromEpoch?: number,
    toEpoch?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: string
  ): never
  listAccessLogsWithUser(
    user: models.UserDto,
    fromEpoch?: number,
    toEpoch?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: string,
    descending?: boolean
  ): Promise<models.AccessLogPaginatedList | any>
  modifyAccessLog(body?: models.AccessLogDto): never
  modifyAccessLogWithUser(
    user: models.UserDto,
    body?: models.AccessLogDto
  ): Promise<models.AccessLogDto | null>
  findByUserAfterDate(
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    descending?: boolean
  ): never
  findByUserAfterDateWithUser(
    user: models.UserDto,
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    descending?: boolean
  ): Promise<models.AccessLogDto | any>
}
