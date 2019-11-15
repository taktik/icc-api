import { iccAccesslogApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as models from "../icc-api/model/models"

import * as _ from "lodash"
import { utils } from "./crypto/utils"

export class IccAccesslogXApi extends iccAccesslogApi {
  crypto: IccCryptoXApi
  cryptedKeys = ["detail"]

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : (self.fetch as any)
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }

  newInstance(user: models.UserDto, patient: models.PatientDto, h: any) {
    const hcpId = user.healthcarePartyId || user.patientId
    const accessslog = _.assign(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.AccessLog",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        date: +new Date(),
        responsible: hcpId,
        author: user.id,
        codes: [],
        tags: [],
        user: user.id,
        accessType: "USER_ACCESS"
      },
      h || {}
    )

    return this.crypto
      .extractDelegationsSFKs(patient, hcpId)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            accessslog,
            patient,
            hcpId!,
            secretForeignKeys.extractedKeys[0]
          ),
          this.crypto.initEncryptionKeys(accessslog, hcpId!)
        ])
      )
      .then(([dels, eks]) => {
        _.extend(accessslog, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys
        })

        let promise = Promise.resolve(accessslog)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(helement =>
              this.crypto
                .addDelegationsAndEncryptionKeys(
                  patient,
                  accessslog,
                  hcpId!,
                  delegateId,
                  dels.secretId,
                  eks.secretId
                )
                .catch(e => {
                  console.log(e)
                  return accessslog
                })
            ))
        )
        return promise
      })
  }

  // noinspection JSUnusedGlobalSymbols
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

  findBy(hcpartyId: string, patient: models.PatientDto) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then(
        secretForeignKeys =>
          secretForeignKeys &&
          secretForeignKeys.extractedKeys &&
          secretForeignKeys.extractedKeys.length > 0
            ? this.findByHCPartyPatientSecretFKeys(
                secretForeignKeys.hcpartyId!,
                secretForeignKeys.extractedKeys.join(",")
              )
            : Promise.resolve([])
      )
  }

  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys?: string
  ): Promise<Array<models.ContactDto> | any> {
    return super
      .findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys)
      .then(accesslogs => this.decrypt(hcPartyId, accesslogs))
  }

  decrypt(
    hcpId: string,
    accessLogs: Array<models.AccessLogDto>
  ): Promise<Array<models.AccessLogDto>> {
    //First check that we have no dangling delegation

    return Promise.all(
      accessLogs.map(accessLog => {
        return accessLog.encryptedSelf
          ? this.crypto
              .extractKeysFromDelegationsForHcpHierarchy(
                hcpId!,
                accessLog.id!,
                _.size(accessLog.encryptionKeys)
                  ? accessLog.encryptionKeys!
                  : accessLog.delegations!
              )
              .then(({ extractedKeys: sfks }) => {
                if (!sfks || !sfks.length) {
                  //console.log("Cannot decrypt contact", ctc.id)
                  return Promise.resolve(accessLog)
                }
                return this.crypto.AES.importKey(
                  "raw",
                  utils.hex2ua(sfks[0].replace(/-/g, ""))
                ).then(key =>
                  utils.decrypt(accessLog, ec =>
                    this.crypto.AES.decrypt(key, ec).then(dec => {
                      const jsonContent = dec && utils.ua2utf8(dec)
                      try {
                        return JSON.parse(jsonContent)
                      } catch (e) {
                        console.log(
                          "Cannot parse access log",
                          accessLog.id,
                          jsonContent || "Invalid content"
                        )
                        return {}
                      }
                    })
                  )
                )
              })
          : Promise.resolve(accessLog)
      })
    )
  }

  initEncryptionKeys(user: models.UserDto, accessLogDto: models.AccessLogDto) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(accessLogDto, hcpId!).then(eks => {
      let promise = Promise.resolve(
        _.extend(accessLogDto, {
          encryptionKeys: eks.encryptionKeys
        })
      )
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(accessLog =>
            this.crypto
              .appendEncryptionKeys(accessLog, hcpId!, delegateId, eks.secretId)
              .then(extraEks => {
                return _.extend(accessLog, {
                  encryptionKeys: extraEks.encryptionKeys
                })
              })
          ))
      )
      return promise
    })
  }

  encrypt(
    user: models.UserDto,
    accessLogs: Array<models.AccessLogDto>
  ): Promise<Array<models.AccessLogDto>> {
    return Promise.all(
      accessLogs.map(accessLog =>
        (accessLog.encryptionKeys && Object.keys(accessLog.encryptionKeys).length
          ? Promise.resolve(accessLog)
          : this.initEncryptionKeys(user, accessLog)
        )
          .then(accessLog =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(
              (user.healthcarePartyId || user.patientId)!,
              accessLog.id!,
              accessLog.encryptionKeys!
            )
          )
          .then((eks: { extractedKeys: Array<string>; hcpartyId: string }) =>
            this.crypto.AES.importKey("raw", utils.hex2ua(eks.extractedKeys[0].replace(/-/g, "")))
          )
          .then((key: CryptoKey) =>
            utils.crypt(
              accessLog,
              (obj: { [key: string]: string }) =>
                this.crypto.AES.encrypt(key, utils.utf82ua(JSON.stringify(obj))),
              this.cryptedKeys
            )
          )
      )
    )
  }

  createAccessLog(body?: models.AccessLogDto): never {
    throw new Error(
      "Cannot call a method that returns access logs without providing a user for de/encryption"
    )
  }

  createAccessLogWithUser(
    user: models.UserDto,
    body?: models.AccessLogDto
  ): Promise<models.AccessLogDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then(als => super.createAccessLog(als[0]))
          .then(accessLog => this.decrypt((user.healthcarePartyId || user.patientId)!, [accessLog]))
          .then(als => als[0])
      : Promise.resolve(null)
  }

  getAccessLog(accessLogId: string): never {
    throw new Error(
      "Cannot call a method that returns access logs without providing a user for de/encryption"
    )
  }

  getAccessLogWithUser(
    user: models.UserDto,
    accessLogId: string
  ): Promise<models.AccessLogDto | any> {
    return super
      .getAccessLog(accessLogId)
      .then(accessLog => this.decrypt((user.healthcarePartyId || user.patientId)!, [accessLog]))
      .then(als => als[0])
  }

  listAccessLogs(startKey?: string, startDocumentId?: string, limit?: string): never {
    throw new Error(
      "Cannot call a method that returns access logs without providing a user for de/encryption"
    )
  }

  listAccessLogsWithUser(
    user: models.UserDto,
    startKey?: string,
    startDocumentId?: string,
    limit?: string,
    descending?: boolean
  ): Promise<models.AccessLogPaginatedList | any> {
    return super
      .listAccessLogs(startKey, startDocumentId, limit, descending)
      .then(accessLog =>
        this.decrypt((user.healthcarePartyId || user.patientId)!, accessLog.rows).then(dr =>
          Object.assign(accessLog, { rows: dr })
        )
      )
  }

  modifyAccessLog(body?: models.AccessLogDto): never {
    throw new Error(
      "Cannot call a method that returns access logs without providing a user for de/encryption"
    )
  }

  modifyAccessLogWithUser(
    user: models.UserDto,
    body?: models.AccessLogDto
  ): Promise<models.AccessLogDto | null> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then(als => super.modifyAccessLog(als[0]))
          .then(accessLog => this.decrypt((user.healthcarePartyId || user.patientId)!, [accessLog]))
          .then(als => als[0])
      : Promise.resolve(null)
  }

  findByUserAfterDate(
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    descending?: boolean
  ): never {
    throw new Error(
      "Cannot call a method that returns access logs without providing a user for de/encryption"
    )
  }

  findByUserAfterDateWithUser(
    user: models.UserDto,
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    descending?: boolean
  ): Promise<models.AccessLogDto | any> {
    return super
      .findByUserAfterDate(
        userId,
        accessType,
        startDate,
        startKey,
        startDocumentId,
        limit,
        descending
      )
      .then(accessLog =>
        this.decrypt((user.healthcarePartyId || user.patientId)!, accessLog.rows).then(dr =>
          Object.assign(accessLog, { rows: dr })
        )
      )
  }
}
