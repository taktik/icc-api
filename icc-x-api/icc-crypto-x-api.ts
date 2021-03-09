import { iccHcpartyApi, iccPatientApi } from "../icc-api/iccApi"
import { AES, AESUtils } from "./crypto/AES"
import { RSA, RSAUtils } from "./crypto/RSA"
import { utils, UtilsClass } from "./crypto/utils"
import { shamir, ShamirClass } from "./crypto/shamir"

import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import { DelegationDto, HealthcarePartyDto, PatientDto } from "../icc-api/model/models"
import { IccHcpartyXApi } from "./icc-hcparty-x-api"

export class IccCryptoXApi {
  get shamir(): ShamirClass {
    return this._shamir
  }
  get utils(): UtilsClass {
    return this._utils
  }
  get RSA(): RSAUtils {
    return this._RSA
  }
  get AES(): AESUtils {
    return this._AES
  }
  hcPartyKeysCache: {
    [key: string]: { delegatorId: string; key: CryptoKey; rawKey: string }
  } = {}

  //[delegateId][delegatorId] = delegateEncryptedHcPartyKey
  //for each delegate, it stores the list of delegators and the corresponding delegateEncryptedHcPartyKey (shared HcPartyKey, from delegator to delegate, encrypted with the RSA key of the delegate)
  hcPartyKeysRequestsCache: {
    [delegateId: string]: Promise<{ [delegatorId: string]: string }>
  } = {}

  emptyHcpCache(hcpartyId: string) {
    delete this.hcPartyKeysRequestsCache[hcpartyId]
  }

  private getHcpOrPatient(
    hcpartyId: string
  ): Promise<models.HealthcarePartyDto | models.PatientDto> {
    return this.hcpartyBaseApi
      .getHealthcareParty(hcpartyId)
      .catch(() => this.patientBaseApi.getPatient(hcpartyId))
  }

  /**
   * Gets all delegate encrypted HcParty keys of the delegate with the given `delegateHcPartyId`, and for each key the delegator id
   * If the keys are not cached, they are retrieved from the backend.
   *
   * @param delegateHcPartyId The Health Care Party id
   * @returns  \{delegatorId: delegateEncryptedHcPartyKey\}
   */
  private getHcPartyKeysForDelegate(
    //TODO: suggested name: getAllEncryptedHcPKeysOfDelegate
    delegateHcPartyId: string
  ): Promise<{ [delegatorId: string]: string }> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.forceGetHcPartyKeysForDelegate(
        delegateHcPartyId
      ))
    )
  }

  private forceGetHcPartyKeysForDelegate(
    delegateHcPartyId: string
  ): Promise<{ [delegatorId: string]: string } | {}> {
    return Promise.all([
      this.patientBaseApi.getPatientHcPartyKeysForDelegate(delegateHcPartyId).catch(() => {}),
      this.hcpartyBaseApi.getHcPartyKeysForDelegate(delegateHcPartyId).catch(() => {})
    ]).then(([a, b]) => Object.assign({}, a, b))
  }

  keychainLocalStoreIdPrefix: String = "org.taktik.icure.ehealth.keychain."
  hcpPreferenceKeyEhealthCert: string = "eHealthCRT"

  private hcpartyBaseApi: iccHcpartyApi
  private patientBaseApi: iccPatientApi
  private crypto: Crypto

  private generateKeyConcurrencyMap: { [key: string]: PromiseLike<HealthcarePartyDto | PatientDto> }

  private _AES: AESUtils
  private _RSA: RSAUtils
  private _utils: UtilsClass
  private _shamir: ShamirClass

  constructor(
    host: string,
    headers: { [key: string]: string },
    hcpartyBaseApi: iccHcpartyApi, //Init with a hcparty x api for better performances
    patientBaseApi: iccPatientApi,
    crypto: Crypto = typeof window !== "undefined"
      ? window.crypto
      : typeof self !== "undefined"
        ? self.crypto
        : ({} as Crypto)
  ) {
    this.hcpartyBaseApi = hcpartyBaseApi
    this.patientBaseApi = patientBaseApi
    this.crypto = crypto
    this.generateKeyConcurrencyMap = {}

    this._AES = new AESUtils(crypto)
    this._RSA = new RSAUtils(crypto)
    this._utils = new UtilsClass()
    this._shamir = new ShamirClass(crypto)
  }

  randomUuid() {
    return ((1e7).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      c =>
        (
          Number(c) ^
          ((this.crypto.getRandomValues(new Uint8Array(1))! as Uint8Array)[0] &
            (15 >> (Number(c) / 4)))
        ).toString(16) //Keep that inlined or you will loose the random
    )
  }

  encryptedShamirRSAKey(
    hcp: HealthcarePartyDto,
    notaries: Array<HealthcarePartyDto>,
    threshold?: number
  ): Promise<HealthcarePartyDto> {
    return this._RSA.loadKeyPairImported(hcp.id!).then(keyPair =>
      this._RSA.exportKey(keyPair.privateKey, "pkcs8").then(exportedKey => {
        const privateKey = exportedKey as ArrayBuffer
        const nLen = notaries.length
        const shares =
          nLen == 1
            ? [privateKey]
            : this._shamir
                .share(this._utils.ua2hex(privateKey), nLen, threshold || nLen)
                .map(share => this.utils.hex2ua(share))

        return _.reduce(
          notaries,
          (queue, notary, idx) => {
            return queue.then(async hcp => {
              const hcParty = hcp.hcPartyKeys![notary.id!]
                ? hcp
                : ((await this.generateKeyForDelegate(hcp.id!, notary.id!)) as HealthcarePartyDto)

              try {
                const importedAESHcPartyKey = await this.decryptHcPartyKey(
                  hcParty.id!,
                  notary.id!,
                  hcParty.hcPartyKeys![notary.id!][1],
                  false
                )
                const encryptedShamirPartition = await this.AES.encrypt(
                  importedAESHcPartyKey.key,
                  shares[idx]
                )

                hcParty.privateKeyShamirPartitions = hcParty.privateKeyShamirPartitions || {}
                hcParty.privateKeyShamirPartitions[notary.id!] = this.utils.ua2hex(
                  encryptedShamirPartition
                )
              } catch (e) {
                console.log("Error during encryptedShamirRSAKey", notary.id, e)
              }
              return hcParty
            })
          },
          Promise.resolve(hcp)
        )
      })
    )
  }

  /* Reconstructs the hcp's private key from the notaries' shamir shares and stores it in localstorage.
  The retrieval procedure of the shares is not designed or implemented yet.  Therefore, it currently only
  works if the private key of the notaries are stored in local storage (e.g. notaries = [hcp parent]).
   * @param hcp : the hcp whose key we want to reconstruct
   * @param notaries : holders of the shamir shares
  **/
  async decryptedShamirRSAKey(
    hcp: HealthcarePartyDto,
    notaries: Array<HealthcarePartyDto>
  ): Promise<void> {
    try {
      const nLen = notaries.length
      let decryptedPrivatedKey
      if (nLen == 1) {
        const importedAESHcPartyKey = await this.decryptHcPartyKey(
          hcp.id!,
          notaries[0].id!,
          hcp.hcPartyKeys![notaries[0].id!][1],
          false
        )
        const cryptedPrivatedKey = hcp.privateKeyShamirPartitions![notaries[0].id!]
        decryptedPrivatedKey = this.utils.ua2hex(
          await this.AES.decrypt(importedAESHcPartyKey.key, this.utils.hex2ua(cryptedPrivatedKey))
        )
      } else {
        const decryptedShares: string[] = await _.reduce(
          notaries,
          (queue, notary) => {
            return queue.then(async (shares: string[]) => {
              try {
                // TODO: now, we get the encrypted shares in db and decrypt them. This assumes that the
                // the notaries' private keys are in localstorage. We should implement a way for the notaries to
                // give hcp the decrypted shares without having to also share their private keys.
                const importedAESHcPartyKey = await this.decryptHcPartyKey(
                  hcp.id!,
                  notary.id!,
                  hcp.hcPartyKeys![notary.id!][1],
                  false
                )
                const encryptedShare = hcp.privateKeyShamirPartitions![notary.id!]
                const decryptedShamirPartition = this.utils.ua2hex(
                  await this.AES.decrypt(
                    importedAESHcPartyKey.key,
                    this.utils.hex2ua(encryptedShare)
                  )
                )
                shares.push(decryptedShamirPartition)
              } catch (e) {
                console.log("Error during encryptedShamirRSAKey", notary.id, e)
              }
              return shares
            })
          },
          Promise.resolve([] as string[])
        )

        decryptedPrivatedKey = this._shamir.combine(decryptedShares)
      }

      const importedPrivateKey = await this.RSA.importKey(
        "pkcs8",
        this.utils.hex2ua(decryptedPrivatedKey),
        ["decrypt"]
      )
      const importedPublicKey = await this.RSA.importKey(
        "spki",
        this.utils.hex2ua(hcp.publicKey!),
        ["encrypt"]
      )

      const exportedKeyPair = await this.RSA.exportKeys(
        { publicKey: importedPublicKey, privateKey: importedPrivateKey },
        "jwk",
        "jwk"
      )
      this.RSA.storeKeyPair(hcp.id!, exportedKeyPair)
    } catch (e) {
      console.log("Cannot decrypt shamir RSA key")
    }
  }

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
    encryptedForDelegator: boolean = false //TODO: suggestion: break this into 2 separate methods: decryptDelegatorEncryptedHcPartyKey() and decryptDelegateEncryptedHcPartyKey()
  ): Promise<{ delegatorId: string; key: CryptoKey; rawKey: string }> {
    const cacheKey =
      delegatorId + "|" + delegateHcPartyId + "|" + (encryptedForDelegator ? "->" : "<-")
    const res = this.hcPartyKeysCache[cacheKey]
    const hcPartyKeyOwner = encryptedForDelegator ? delegatorId : delegateHcPartyId
    if (res) {
      return Promise.resolve(res)
    } else {
      const keyPair = this._RSA.rsaKeyPairs[hcPartyKeyOwner]
      return (keyPair
        ? Promise.resolve(keyPair)
        : Promise.resolve(this._RSA.loadKeyPairNotImported(hcPartyKeyOwner)).then(keyPairInJwk =>
            this.cacheKeyPair(keyPairInJwk, hcPartyKeyOwner)
          )
      )
        .then(keyPair =>
          this._RSA.decrypt(keyPair.privateKey, this._utils.hex2ua(encryptedHcPartyKey))
        )
        .catch(e => {
          console.log(
            `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId} as ${
              encryptedForDelegator ? "delegator" : "delegate"
            }`
          )
          throw e
        })
        .then(decryptedHcPartyKey =>
          this._AES.importKey("raw", decryptedHcPartyKey).then(decryptedImportedHcPartyKey => ({
            decryptedHcPartyKey,
            decryptedImportedHcPartyKey
          }))
        )
        .then(
          ({ decryptedHcPartyKey, decryptedImportedHcPartyKey }) =>
            (this.hcPartyKeysCache[cacheKey] = {
              delegatorId: delegatorId,
              key: decryptedImportedHcPartyKey,
              rawKey: this.utils.ua2hex(new Uint8Array(decryptedHcPartyKey))
            })
        )
    }
  }
  /**
   * Cache the RSA private/public key pair for the HcP with the given id `hcPartyKeyOwner`
   */
  cacheKeyPair(
    keyPairInJwk: { publicKey: JsonWebKey | ArrayBuffer; privateKey: JsonWebKey | ArrayBuffer },
    hcPartyKeyOwner: string
  ) {
    if (!keyPairInJwk) {
      throw "No RSA private key for Healthcare party(" + hcPartyKeyOwner + ")."
    }
    return this._RSA
      .importKeyPair("jwk", keyPairInJwk.privateKey, "jwk", keyPairInJwk.publicKey)
      .then(importedKeyPair => {
        return (this._RSA.rsaKeyPairs[hcPartyKeyOwner] = importedKeyPair)
      })
  }

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
  ) {
    return this.extractSFKsHierarchyFromDelegations(parent, hcpartyId).then(secretForeignKeys => {
      const keys = secretForeignKeys
        .filter(({ extractedKeys }) => extractedKeys.length > 0)
        .filter((x, idx) => (confidential ? x.hcpartyId === hcpartyId : idx === 0))[0]
      return (
        (keys &&
          (confidential
            ? keys.extractedKeys.find(
                k =>
                  !secretForeignKeys.some(
                    ({ extractedKeys, hcpartyId: parentHcpId }) =>
                      hcpartyId !== parentHcpId && extractedKeys.includes(k)
                  )
              )
            : keys.extractedKeys[0])) ||
        null
      )
    })
  }

  /**
   * Gets an array of decrypted HcPartyKeys, shared between the delegate with ID `delegateHcPartyId` and the delegators in `delegatorsHcPartyIdsSet`
   *
   * 1. Get the keys for the delegateHealthCareParty (cache/backend).
   * 2. For each key in the delegators, decrypt it with the delegate's private key
   * 3. Filter out undefined keys and return them
   *
   * @param delegatorsHcPartyIdsSet array of delegator HcP IDs that could have delegated something to the HcP with ID `delegateHcPartyId`
   * @param delegateHcPartyId the HcP for which the HcPs with IDs in `delegatorsHcPartyIdsSet` could have delegated something
   * @returns - **delegatorId** : the id of the delegator HcP that shares the **key** with the `delegateHcPartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `delegateHcPartyId`
   */
  decryptAndImportAesHcPartyKeysForDelegators(
    //TODO:  suggested name: getDecryptedHcPKeysSharedBetweenDelegateAndDelegators
    delegatorsHcPartyIdsSet: Array<string>,
    delegateHcPartyId: string
  ): Promise<Array<{ delegatorId: string; key: CryptoKey; rawKey: string }>> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.getHcPartyKeysForDelegate(
        delegateHcPartyId
      ))
    ).then((delegatorIDsWithDelegateEncryptedHcPartyKey: { [delegatorId: string]: string }) => {
      // [key: delegatorId] = delegateEncryptedHcPartyKey
      // For each delegatorId, obtain the AES key (decrypted HcParty Key) shared with the delegate, decrypted by the delegate
      return Promise.all(
        delegatorsHcPartyIdsSet.map((delegatorId: string) => {
          if (!delegatorIDsWithDelegateEncryptedHcPartyKey[delegatorId]) {
            return undefined
          }
          return this.decryptHcPartyKey(
            delegatorId,
            delegateHcPartyId,
            delegatorIDsWithDelegateEncryptedHcPartyKey[delegatorId]
          ).catch(() => {
            console.log(`failed to decrypt hcPartyKey from ${delegatorId} to ${delegateHcPartyId}`)
            return undefined
          })
        })
      ).then(hcPartyKeys =>
        hcPartyKeys.filter(<T>(hcPartyKey: T | undefined): hcPartyKey is T => !!hcPartyKey)
      )
    })
  }

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
    //TODO: suggested name: getDecryptedHcPKeysOfDelegateAndParentsFromGenericDelegations
    healthcarePartyId: string,
    delegations: { [key: string]: Array<models.DelegationDto> },
    fallbackOnParent = true
  ): Promise<Array<{ delegatorId: string; key: CryptoKey; rawKey: string }>> {
    const delegatorIds: { [key: string]: boolean } = {}
    const delegationsArray = delegations[healthcarePartyId]
    if (delegationsArray && delegationsArray.length) {
      delegationsArray.forEach(function(delegationItem) {
        delegatorIds[delegationItem.owner!] = true //TODO: why is set to true?
      })
    } else if (fallbackOnParent) {
      return this.getHcpOrPatient(healthcarePartyId).then(
        hcp =>
          (hcp as any).parentId
            ? this.decryptAndImportAesHcPartyKeysInDelegations((hcp as any).parentId, delegations)
            : Promise.resolve([])
      )
    }

    return this.decryptAndImportAesHcPartyKeysForDelegators(
      Object.keys(delegatorIds),
      healthcarePartyId
    )
  }

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
  }> {
    this.throwDetailedExceptionForInvalidParameter(
      "createdObject.id",
      createdObject.id,
      "initObjectDelegations",
      arguments
    )

    if (parentObject)
      this.throwDetailedExceptionForInvalidParameter(
        "parentObject.id",
        parentObject.id,
        "initObjectDelegations",
        arguments
      )

    const secretId = this.randomUuid()
    return this.getHcpOrPatient(ownerId)
      .then(owner => owner.hcPartyKeys![ownerId][0])
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
          this._AES.encrypt(
            importedAESHcPartyKey.key,
            utils.text2ua(createdObject.id + ":" + secretId).buffer as ArrayBuffer,
            importedAESHcPartyKey.rawKey
          ),
          parentObject
            ? this._AES.encrypt(
                importedAESHcPartyKey.key,
                utils.text2ua(createdObject.id + ":" + parentObject.id).buffer as ArrayBuffer,
                importedAESHcPartyKey.rawKey
              )
            : Promise.resolve(null)
        ])
      )
      .then(encryptedDelegationAndSecretForeignKey => ({
        delegations: _.fromPairs([
          [
            ownerId,
            [
              {
                owner: ownerId,
                delegatedTo: ownerId,
                key: this._utils.ua2hex(encryptedDelegationAndSecretForeignKey[0]!)
              }
            ]
          ]
        ]),
        cryptedForeignKeys:
          (encryptedDelegationAndSecretForeignKey[1] &&
            _.fromPairs([
              [
                ownerId,
                [
                  {
                    owner: ownerId,
                    delegatedTo: ownerId,
                    key: this._utils.ua2hex(encryptedDelegationAndSecretForeignKey[1]!)
                  }
                ]
              ]
            ])) ||
          {},
        secretForeignKeys: (secretForeignKeyOfParent && [secretForeignKeyOfParent]) || [],
        secretId: secretId
      }))
  }
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
    //TODO: suggested name: getExtendedChildObjectSPKandCFKwithDelegationFromDelegatorToDelegate
    modifiedObject: any | null,
    parentObject: any | null,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string | null
  ): Promise<{
    delegations: { [key: string]: Array<models.DelegationDto> }
    cryptedForeignKeys: { [key: string]: Array<models.DelegationDto> }
    secretId: string | null //TODO: why input parameter secretIdOfModifiedObject is returned?
  }> {
    this.throwDetailedExceptionForInvalidParameter(
      "modifiedObject.id",
      modifiedObject.id,
      "extendedDelegationsAndCryptedForeignKeys",
      arguments
    ) //modifiedObject should never be null

    if (parentObject)
      this.throwDetailedExceptionForInvalidParameter(
        "parentObject.id",
        parentObject.id,
        "extendedDelegationsAndCryptedForeignKeys",
        arguments
      )

    this.throwDetailedExceptionForInvalidParameter(
      "secretIdOfModifiedObject",
      secretIdOfModifiedObject,
      "extendedDelegationsAndCryptedForeignKeys",
      arguments
    )

    return this.getHcpOrPatient(ownerId)
      .then(owner => {
        if (!owner.hcPartyKeys![delegateId]) {
          return this.generateKeyForDelegate(ownerId, delegateId).then(
            owner => owner.hcPartyKeys![delegateId][0]
          )
        }
        return Promise.resolve(owner.hcPartyKeys![delegateId][0])
      })
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, delegateId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
          Promise.all(((modifiedObject.delegations || {})[delegateId] || []).map(
            (d: DelegationDto) =>
              (d.key &&
                d.owner === ownerId &&
                this._AES
                  .decrypt(
                    importedAESHcPartyKey.key,
                    this._utils.hex2ua(d.key),
                    importedAESHcPartyKey.rawKey
                  )
                  .catch(() => {
                    console.log(
                      `Cannot decrypt delegation from ${d.owner} to ${
                        d.delegatedTo
                      } for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return null
                  })) ||
              Promise.resolve(null)
          ) as Array<Promise<ArrayBuffer>>),

          Promise.all(((modifiedObject.cryptedForeignKeys || {})[delegateId] || []).map(
            (d: DelegationDto) =>
              (d.key &&
                d.owner === ownerId &&
                this._AES
                  .decrypt(
                    importedAESHcPartyKey.key,
                    this._utils.hex2ua(d.key),
                    importedAESHcPartyKey.rawKey
                  )
                  .catch(() => {
                    console.log(
                      `Cannot decrypt cryptedForeignKeys from ${d.owner} to ${
                        d.delegatedTo
                      } for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return null
                  })) ||
              Promise.resolve(null)
          ) as Array<Promise<ArrayBuffer>>),

          this._AES.encrypt(
            importedAESHcPartyKey.key,
            utils.text2ua(modifiedObject.id + ":" + secretIdOfModifiedObject!!)
              .buffer as ArrayBuffer,
            importedAESHcPartyKey.rawKey
          ),

          parentObject
            ? this._AES.encrypt(
                importedAESHcPartyKey.key,
                utils.text2ua(modifiedObject.id + ":" + parentObject.id).buffer as ArrayBuffer,
                importedAESHcPartyKey.rawKey
              )
            : Promise.resolve(null)
        ])
      )
      .then(
        ([
          previousDecryptedDelegations,
          previousDecryptedCryptedForeignKeys,
          cryptedDelegation,
          cryptedForeignKey
        ]) => {
          //try to limit the extent of the modifications to the delegations by preserving the redundant delegation already present and removing duplicates
          //For delegate delegateId, we create:
          // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for each existing delegation and the new key concatenated
          // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
          // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
          const delegationCryptedDecrypted = _.merge(
            ((modifiedObject.delegations || {})[delegateId] || []).map((d: DelegationDto) => ({
              d
            })),
            (previousDecryptedDelegations || [])
              .map(dd => (dd ? this._utils.ua2text(dd) : null))
              .map(k => ({ k }))
          )
            .filter(({ d, k }: { d: DelegationDto; k: String }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
            .map(({ d, k }: { d: DelegationDto; k: String }) => ({ d, k: k || this.randomUuid() })) // Use some unique id that ensures the delegation not created by us are going to be held
            .concat([
              {
                d: {
                  owner: ownerId,
                  delegatedTo: delegateId,
                  key: this._utils.ua2hex(cryptedDelegation!)
                },
                k: modifiedObject.id + ":" + secretIdOfModifiedObject!
              }
            ])

          const allDelegations = _.cloneDeep(modifiedObject.delegations)

          //Only keep one version of the decrypted key
          allDelegations[delegateId] = _.uniqBy(delegationCryptedDecrypted, (x: any) => x.k).map(
            (x: any) => x.d
          )

          const cryptedForeignKeysCryptedDecrypted = _.merge(
            ((modifiedObject.cryptedForeignKeys || {})[delegateId] || []).map(
              (d: DelegationDto) => ({ d })
            ),
            (previousDecryptedCryptedForeignKeys || [])
              .map(dd => (dd ? this._utils.ua2text(dd) : null))
              .map(k => ({ k }))
          )
            .filter(({ d, k }: { d: DelegationDto; k: String }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
            .map(({ d, k }: { d: DelegationDto; k: String }) => ({ d, k: k || this.randomUuid() })) // Use some unique id that ensures the delegation not created by us are going to be held
            .concat(
              cryptedForeignKey
                ? [
                    {
                      d: {
                        owner: ownerId,
                        delegatedTo: delegateId,
                        key: this._utils.ua2hex(cryptedForeignKey)
                      },
                      k: modifiedObject.id + ":" + parentObject.id!
                    }
                  ]
                : []
            )

          const allCryptedForeignKeys = _.cloneDeep(modifiedObject.cryptedForeignKeys || {})
          if (cryptedForeignKeysCryptedDecrypted.length > 0) {
            allCryptedForeignKeys[delegateId] = _.uniqBy(
              cryptedForeignKeysCryptedDecrypted,
              (x: any) => x.k
            ).map((x: any) => x.d)
          }

          return {
            delegations: allDelegations,
            cryptedForeignKeys: allCryptedForeignKeys,
            secretId: secretIdOfModifiedObject
          }
        }
      )
  }

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
  }> {
    this.throwDetailedExceptionForInvalidParameter(
      "createdObject.id",
      createdObject.id,
      "initEncryptionKeys",
      arguments
    )

    const secretId = this.randomUuid()
    return this.getHcPartyKeysForDelegate(ownerId)
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey[ownerId], true)
      )
      .then(importedAESHcPartyKey =>
        this._AES.encrypt(
          importedAESHcPartyKey.key,
          utils.text2ua(createdObject.id + ":" + secretId)
        )
      )
      .then(encryptedEncryptionKeys => ({
        encryptionKeys: _.fromPairs([
          [
            ownerId,
            [
              {
                owner: ownerId,
                delegatedTo: ownerId,
                key: this._utils.ua2hex(encryptedEncryptionKeys)
              }
            ]
          ]
        ]),
        secretId: secretId
      }))
  }

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
    //TODO: suggested name: getExtendedEKwithDelegationFromDelegatorToDelegate
    modifiedObject: any,
    ownerId: string,
    delegateId: string,
    secretEncryptionKeyOfObject: string
  ): Promise<{
    encryptionKeys: { [key: string]: Array<models.DelegationDto> }
    secretId: string | null //secretEncryptionKeyOfObject is returned to avoid the need for a new decryption when chaining calls
  }> {
    this.throwDetailedExceptionForInvalidParameter(
      "modifiedObject.id",
      modifiedObject.id,
      "appendEncryptionKeys",
      arguments
    ) //modifiedObject should never be null

    this.throwDetailedExceptionForInvalidParameter(
      "secretEncryptionKeyOfObject",
      secretEncryptionKeyOfObject,
      "appendEncryptionKeys",
      arguments
    )

    return this.getHcpOrPatient(ownerId)
      .then(owner => {
        if (!owner.hcPartyKeys![delegateId]) {
          return this.generateKeyForDelegate(ownerId, delegateId).then(
            owner => owner.hcPartyKeys![delegateId][0]
          )
        }
        return Promise.resolve(owner.hcPartyKeys![delegateId][0])
      })
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, delegateId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
          Promise.all(((modifiedObject.encryptionKeys || {})[delegateId] || []).map(
            (d: DelegationDto) =>
              (d.key &&
                d.owner === ownerId &&
                this._AES
                  .decrypt(
                    importedAESHcPartyKey.key,
                    this._utils.hex2ua(d.key),
                    importedAESHcPartyKey.rawKey
                  )
                  .catch(() => {
                    console.log(
                      `Cannot decrypt encryption key from ${d.owner} to ${
                        d.delegatedTo
                      } for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return null
                  })) ||
              Promise.resolve(null)
          ) as Array<Promise<ArrayBuffer>>),
          this._AES.encrypt(
            importedAESHcPartyKey.key,
            utils.text2ua(modifiedObject.id + ":" + secretEncryptionKeyOfObject)
          )
        ])
      )
      .then(([previousDecryptedEncryptionKeys, encryptedEncryptionKey]) => {
        //try to limit the extent of the modifications to the delegations by preserving the redundant encryption keys already present and removing duplicates
        //For delegate delegateId, we create:
        // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for the existing encryption keys and the new key concatenated
        // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
        // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
        const encryptionKeysCryptedDecrypted = _.merge(
          ((modifiedObject.encryptionKeys || {})[delegateId] || []).map((d: DelegationDto) => ({
            d
          })),
          (previousDecryptedEncryptionKeys || [])
            .map(dd => (dd ? this._utils.ua2text(dd) : null))
            .map(k => ({ k }))
        )
          .filter(({ d, k }: { d: DelegationDto; k: String }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
          .map(({ d, k }: { d: DelegationDto; k: String }) => ({ d, k: k || this.randomUuid() }))
          .concat([
            {
              d: {
                owner: ownerId,
                delegatedTo: delegateId,
                key: this._utils.ua2hex(encryptedEncryptionKey)
              },
              k: modifiedObject.id + ":" + secretEncryptionKeyOfObject!
            }
          ])

        const allEncryptionKeys = _.cloneDeep(modifiedObject.encryptionKeys)
        allEncryptionKeys[delegateId] = _.uniqBy(
          encryptionKeysCryptedDecrypted,
          (x: any) => x.k
        ).map((x: any) => x.d)

        return {
          encryptionKeys: allEncryptionKeys,
          secretId: secretEncryptionKeyOfObject
        }
      })
  }

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
    //TODO: suggested name: updateChildGenericDelegationsFromDelegatorToDelegate
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
    secretDelegationKey: string | null,
    secretEncryptionKey: string | null
  ): Promise<
    | models.PatientDto
    | models.ContactDto
    | models.InvoiceDto
    | models.DocumentDto
    | models.HealthElementDto
    | models.ReceiptDto
  > {
    if (parent)
      this.throwDetailedExceptionForInvalidParameter(
        "parent.id",
        parent.id,
        "addDelegationsAndEncryptionKeys",
        arguments
      )

    this.throwDetailedExceptionForInvalidParameter(
      "child.id",
      child.id,
      "addDelegationsAndEncryptionKeys",
      arguments
    )

    return (secretDelegationKey
      ? this.extendedDelegationsAndCryptedForeignKeys(
          child,
          parent,
          ownerId,
          delegateId,
          secretDelegationKey
        )
      : Promise.resolve({ delegations: {}, cryptedForeignKeys: {} })
    )
      .then(
        extendedChildObjectSPKsAndCFKs =>
          secretEncryptionKey
            ? this.appendEncryptionKeys(child, ownerId, delegateId, secretEncryptionKey).then(
                //TODO: extendedDelegationsAndCryptedForeignKeys and appendEncryptionKeys can be done in parallel
                extendedChildObjectEKs => ({
                  extendedSPKsAndCFKs: extendedChildObjectSPKsAndCFKs,
                  extendedEKs: extendedChildObjectEKs
                })
              )
            : Promise.resolve({
                extendedSPKsAndCFKs: extendedChildObjectSPKsAndCFKs,
                extendedEKs: { encryptionKeys: {} }
              })
      )
      .then(
        ({
          extendedSPKsAndCFKs: extendedChildObjectSPKsAndCFKs,
          extendedEKs: extendedChildObjectEKs
        }) => {
          return _.assign(child, {
            // Conservative version ... We might want to be more aggressive with the deduplication of keys
            // For each delegate, we are going to concatenate to the src (the new delegations), the object in dest (the current delegations)
            // for which we do not find an equivalent delegation (same delegator, same delegate)
            delegations: _.assignWith(
              child.delegations,
              extendedChildObjectSPKsAndCFKs.delegations,
              (dest, src) =>
                (src || []).concat(
                  _.filter(
                    dest,
                    (d: DelegationDto) =>
                      !src.some(
                        (s: DelegationDto) => s.owner === d.owner && s.delegatedTo === d.delegatedTo
                      )
                  )
                )
            ),
            cryptedForeignKeys: _.assignWith(
              child.cryptedForeignKeys,
              extendedChildObjectSPKsAndCFKs.cryptedForeignKeys,
              (dest, src) =>
                (src || []).concat(
                  _.filter(
                    dest,
                    (d: DelegationDto) =>
                      !src.some(
                        (s: DelegationDto) => s.owner === d.owner && s.delegatedTo === d.delegatedTo
                      )
                  )
                )
            ),
            encryptionKeys: _.assignWith(
              child.encryptionKeys,
              extendedChildObjectEKs.encryptionKeys,
              (dest, src) =>
                (src || []).concat(
                  _.filter(
                    dest,
                    (d: DelegationDto) =>
                      !src.some(
                        (s: DelegationDto) => s.owner === d.owner && s.delegatedTo === d.delegatedTo
                      )
                  )
                )
            )
          })
        }
      )
  }

  /**
   * Gets the secret IDs (SFKs) inside decrypted SPKs of the given `document`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param document : the object of which delegations (SPKs) to decrypt
   * @param hcpartyId : the id of the delegate HcP
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  //TODO: even if there are no delegations for parent HCP (but the parent exists), the returned hcpartyId will be the one of the parent; is this ok?
  extractDelegationsSFKs(
    //TODO: suggested name: getSecretIDsSPKofHcpAndParentsFromDocument
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
  ): Promise<{ extractedKeys: Array<string>; hcpartyId?: string }> {
    if (!document || !hcpartyId) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId }) //TODO: thow exception instead?
    }
    const delegationsForAllDelegates = document.delegations
    if (!delegationsForAllDelegates || !Object.keys(delegationsForAllDelegates).length) {
      console.log(`There is no delegation in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return this.extractKeysFromDelegationsForHcpHierarchy(
      hcpartyId,
      document.id!,
      delegationsForAllDelegates
    )
  }

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
  ): Promise<Array<{ hcpartyId: string; extractedKeys: Array<string> }>> {
    if (!document || !hcpartyId) {
      return Promise.resolve([])
    }
    const delegationsForAllDelegates = document.delegations
    if (!delegationsForAllDelegates || !Object.keys(delegationsForAllDelegates).length) {
      console.log(`There is no delegation in document (${document.id})`)
      return Promise.resolve([])
    }
    return this.extractKeysHierarchyFromDelegationLikes(
      hcpartyId,
      document.id!,
      delegationsForAllDelegates
    )
  }

  // noinspection JSUnusedGlobalSymbols

  extractCryptedFKs(
    //TODO: suggested name: getSecretIDsCFKofHcpAndParentsFromDocument
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
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document || !document.cryptedForeignKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const cfksForAllDelegates = document.cryptedForeignKeys
    if (!cfksForAllDelegates || !Object.keys(cfksForAllDelegates).length) {
      console.log(`There is no cryptedForeignKeys in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return this.extractKeysFromDelegationsForHcpHierarchy(
      hcpartyId,
      document.id!,
      cfksForAllDelegates
    )
  }

  extractEncryptionsSKs(
    //TODO: suggested name: getSecretIDsEKofHcpAndParentsFromDocument
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
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    if (!document.encryptionKeys) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    const eckeysForAllDelegates = document.encryptionKeys
    if (!eckeysForAllDelegates || !Object.keys(eckeysForAllDelegates).length) {
      //console.log(`There is no encryption key in document (${document.id})`)
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
    }
    return this.extractKeysFromDelegationsForHcpHierarchy(
      hcpartyId,
      document.id!,
      eckeysForAllDelegates
    )
  }

  extractDelegationsSFKsAndEncryptionSKs(
    ety:
      | models.PatientDto
      | models.ContactDto
      | models.InvoiceDto
      | models.DocumentDto
      | models.HealthElementDto,
    ownerId: string
  ) {
    const delegationsSfksOwnerPromise = this.extractDelegationsSFKs(ety, ownerId).then(
      xks => xks.extractedKeys
    ) //Will climb up hierarchy
    const encryptionKeysOwnerPromise = this.extractEncryptionsSKs(ety, ownerId).then(
      xks => xks.extractedKeys
    ) //Will climb up hierarchy

    return Promise.all([delegationsSfksOwnerPromise, encryptionKeysOwnerPromise])
  }

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
  //TODO: even if there are no delegations for parent HCP (but the parent exists), the returned hcpartyId will be the one of the parent
  extractKeysHierarchyFromDelegationLikes(
    //TODO suggested name: getSecretIdsOfHcpAndParentsFromGenericDelegations
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<models.DelegationDto> }
  ): Promise<Array<{ hcpartyId: string; extractedKeys: Array<string> }>> {
    return this.getHcpOrPatient(hcpartyId).then(hcp =>
      (delegations[hcpartyId] && delegations[hcpartyId].length
        ? this.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, delegations, false).then(
            decryptedAndImportedAesHcPartyKeys => {
              const collatedAesKeysFromDelegatorToHcpartyId: {
                [key: string]: { key: CryptoKey; rawKey: string }
              } = {}
              decryptedAndImportedAesHcPartyKeys.forEach(
                k => (collatedAesKeysFromDelegatorToHcpartyId[k.delegatorId] = k)
              )
              return this.decryptKeyInDelegationLikes(
                delegations[hcpartyId],
                collatedAesKeysFromDelegatorToHcpartyId,
                objectId!
              )
            }
          )
        : Promise.resolve([])
      ).then(
        extractedKeys =>
          (hcp as HealthcarePartyDto).parentId
            ? this.extractKeysHierarchyFromDelegationLikes(
                (hcp as HealthcarePartyDto).parentId!,
                objectId,
                delegations
              ).then(parentResponse =>
                parentResponse.concat({ extractedKeys: extractedKeys, hcpartyId: hcpartyId })
              )
            : [{ extractedKeys: extractedKeys, hcpartyId: hcpartyId }]
      )
    )
  }

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
  //TODO: even if there are no delegations for parent HCP (but the parent exists), the returned hcpartyId will be the one of the parent
  extractKeysFromDelegationsForHcpHierarchy(
    //TODO suggested name: getSecretIdsOfHcpAndParentsFromGenericDelegations
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<models.DelegationDto> }
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    return this.getHcpOrPatient(hcpartyId).then(hcp =>
      (delegations[hcpartyId] && delegations[hcpartyId].length
        ? this.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, delegations, false).then(
            decryptedAndImportedAesHcPartyKeys => {
              const collatedAesKeysFromDelegatorToHcpartyId: {
                [key: string]: { key: CryptoKey; rawKey: string }
              } = {}
              decryptedAndImportedAesHcPartyKeys.forEach(
                k => (collatedAesKeysFromDelegatorToHcpartyId[k.delegatorId] = k)
              )
              return this.decryptKeyInDelegationLikes(
                delegations[hcpartyId],
                collatedAesKeysFromDelegatorToHcpartyId,
                objectId!
              )
            }
          )
        : Promise.resolve([])
      ).then(
        extractedKeys =>
          (hcp as HealthcarePartyDto).parentId
            ? this.extractKeysFromDelegationsForHcpHierarchy(
                (hcp as HealthcarePartyDto).parentId!,
                objectId,
                delegations
              ).then(parentResponse =>
                _.assign(parentResponse, {
                  extractedKeys: parentResponse.extractedKeys.concat(extractedKeys)
                })
              )
            : { extractedKeys: extractedKeys, hcpartyId: hcpartyId }
      )
    )
  }

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
    //TODO: suggested name: getSecretIdsFromGenericDelegations
    delegationsArray: Array<models.DelegationDto>,
    aesKeys: { [key: string]: { key: CryptoKey; rawKey: string } },
    masterId: string
  ): Promise<Array<string>> {
    const decryptPromises: Array<Promise<string | undefined>> = []
    for (var i = 0; i < (delegationsArray || []).length; i++) {
      var genericDelegationItem = delegationsArray[i]
      const aesKey = aesKeys[genericDelegationItem.owner!!]
      if (aesKey) {
        decryptPromises.push(
          this._AES
            .decrypt(aesKey.key, this._utils.hex2ua(genericDelegationItem.key!!), aesKey.rawKey)
            .then((decryptedGenericDelegationKey: ArrayBuffer) => {
              const results = utils.ua2text(decryptedGenericDelegationKey).split(":")

              const objectId = results[0] //must be the ID of the object, for checksum
              const genericSecretId = results[1]

              const details =
                "object ID: " +
                masterId +
                "; generic delegation from " +
                genericDelegationItem.owner +
                " to " +
                genericDelegationItem.delegatedTo

              if (!objectId) console.warn("Object id is empty; " + details)
              if (!genericSecretId) console.warn("Secret id is empty; " + details)

              if (objectId !== masterId) {
                /*console.log(
                  "Cryptographic mistake: object ID is not equal to the expected concatenated id within decrypted generic delegation. This may happen when patients have been merged; " +
                    details
                )*/
              }

              return genericSecretId
            })
            .catch(err => {
              console.log(
                `Could not decrypt generic delegation in object with ID: ${masterId} from ${
                  genericDelegationItem.owner
                } to ${genericDelegationItem.delegatedTo}: ${err}`
              )
              return undefined
            })
        )
      } else {
        console.log(`Could not find aes key for object with ID: ${masterId}`)
      }
    }

    return Promise.all(decryptPromises).then(
      genericSecretId => genericSecretId.filter(id => !!id) as string[]
    )
  }

  loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    return this.getHcpOrPatient(healthcarePartyId)
      .then(hcpOrPat => hcpOrPat.publicKey)
      .then((publicKey?: string) => {
        if (!publicKey) {
          throw new Error("No public key has been defined for hcp")
        }
        return this._RSA.importKeyPair(
          "jwk",
          this._utils.pkcs8ToJwk(privateKey),
          "jwk",
          utils.spkiToJwk(utils.hex2ua(publicKey))
        )
      })
      .then((keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) => {
        this._RSA.rsaKeyPairs[healthcarePartyId] = keyPair
        return this._RSA.exportKeys(keyPair, "jwk", "jwk")
      })
      .then(exportedKeyPair => {
        return this._RSA.storeKeyPair(healthcarePartyId, exportedKeyPair)
      })
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeyPairsAsJwkInBrowserLocalStorage(healthcarePartyId: string, privKey: JsonWebKey) {
    return this.hcpartyBaseApi
      .getPublicKey(healthcarePartyId)
      .then((publicKey: models.PublicKeyDto) => {
        const pubKey = utils.spkiToJwk(utils.hex2ua(publicKey.hexString!))

        privKey.n = pubKey.n
        privKey.e = pubKey.e

        return this._RSA.importKeyPair("jwk", privKey, "jwk", pubKey)
      })
      .then((keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) => {
        this._RSA.rsaKeyPairs[healthcarePartyId] = keyPair
        return this._RSA.exportKeys(keyPair, "jwk", "jwk")
      })
      .then((exportedKeyPair: { publicKey: any; privateKey: any }) => {
        return this._RSA.storeKeyPair(healthcarePartyId, exportedKeyPair)
      })
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeyPairsInBrowserLocalStorage(healthcarePartyId: string, file: Blob) {
    const fr = new FileReader()
    return new Promise((resolve: (() => void), reject) => {
      fr.onerror = reject
      fr.onabort = reject
      fr.onload = (e: any) => {
        //TODO remove any
        const privateKey = e.target.result as string
        this.loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId, utils.hex2ua(privateKey))
          .then(resolve)
          .catch(reject)
      }
      fr.readAsText(file)
    })
  }

  // noinspection JSUnusedGlobalSymbols
  saveKeychainInBrowserLocalStorage(id: string, keychain: number) {
    localStorage.setItem(
      this.keychainLocalStoreIdPrefix + id,
      btoa(new Uint8Array(keychain).reduce((data, byte) => data + String.fromCharCode(byte), ""))
    )
  }

  saveKeychainInBrowserLocalStorageAsBase64(id: string, keyChainB64: string) {
    localStorage.setItem(this.keychainLocalStoreIdPrefix + id, keyChainB64)
  }

  saveKeyChainInHCPFromLocalStorage(hcpId: string): Promise<HealthcarePartyDto> {
    return this.hcpartyBaseApi
      .getHealthcareParty(hcpId)
      .then(hcp => {
        const crt = this.getKeychainInBrowserLocalStorageAsBase64(hcp.id!!)
        const opts = hcp.options || {}
        _.set(opts, this.hcpPreferenceKeyEhealthCert, crt)
        hcp.options = opts
        return hcp
      })
      .then(hcp => {
        return this.hcpartyBaseApi.modifyHealthcareParty(hcp)
      })
  }

  importKeychainInBrowserFromHCP(hcpId: string): Promise<void> {
    return this.hcpartyBaseApi.getHealthcareParty(hcpId).then(hcp => {
      const crt = _.get(hcp.options, this.hcpPreferenceKeyEhealthCert)
      if (crt) {
        this.saveKeychainInBrowserLocalStorageAsBase64(hcp.id!!, crt)
      }
    })
  }

  /**
   * Returns true if a key has been set in the localstorage
   * @param hcpId The healthcare party id
   */
  syncEhealthCertificate(hcpId: string): Promise<boolean> {
    return this.hcpartyBaseApi.getHealthcareParty(hcpId).then(hcp => {
      const crtHCP = _.get(hcp.options, this.hcpPreferenceKeyEhealthCert)
      const crtLC = this.getKeychainInBrowserLocalStorageAsBase64(hcp.id!!)
      const xor_hcp_localstorage = !(crtHCP && crtLC) && (crtHCP || crtLC)

      if (!xor_hcp_localstorage) {
        // The key is either present in the 2 sources or absent from the 2 sources
        return !!crtLC
      }
      if (crtHCP) {
        return this.importKeychainInBrowserFromHCP(hcp.id!!)
          .then(() => true)
          .catch(() => false)
      } else {
        return this.saveKeyChainInHCPFromLocalStorage(hcp.id!!)
          .then(() => true)
          .catch(() => false)
      }
    })
  }

  getKeychainInBrowserLocalStorageAsBase64(id: string) {
    return localStorage.getItem(this.keychainLocalStoreIdPrefix + id)
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeychainFromBrowserLocalStorage(id: String) {
    const lsItem = localStorage.getItem("org.taktik.icure.ehealth.keychain." + id)
    return lsItem !== null ? this._utils.base64toByteArray(lsItem) : null
  }

  generateKeyForDelegate(
    ownerId: string,
    delegateId: string
  ): PromiseLike<models.HealthcarePartyDto | models.PatientDto> {
    //Preload hcp and patient because we need them and they are going to be invalidated from the caches
    return this.utils.notConcurrent(this.generateKeyConcurrencyMap, ownerId, () =>
      Promise.all([
        (this.hcpartyBaseApi as IccHcpartyXApi)
          .getHealthcareParty(ownerId, true)
          .then(x => ({ type: "hcp", hcpOrPat: x }))
          .catch(e =>
            this.patientBaseApi.getPatient(ownerId).then(x => ({ type: "patient", hcpOrPat: x }))
          ),
        (this.hcpartyBaseApi as IccHcpartyXApi)
          .getHealthcareParty(delegateId, true)
          .then(x => ({ type: "hcp", hcpOrPat: x }))
          .catch(e =>
            this.patientBaseApi.getPatient(delegateId).then(x => ({ type: "patient", hcpOrPat: x }))
          )
      ]).then(([{ type: ownerType, hcpOrPat: owner }, { hcpOrPat: delegate }]) => {
        if ((owner.hcPartyKeys || {})[delegateId]) {
          return owner
        }
        const genProm = new Promise<
          [null | "hcp" | "patient", models.HealthcarePartyDto | models.PatientDto]
        >((resolve, reject) => {
          delegate.publicKey
            ? this._AES
                .generateCryptoKey(true)
                .then(AESKey => {
                  const ownerPubKey = utils.spkiToJwk(utils.hex2ua(owner.publicKey!))
                  const delegatePubKey = utils.spkiToJwk(utils.hex2ua(delegate.publicKey!))

                  return Promise.all([
                    this._RSA.importKey("jwk", ownerPubKey, ["encrypt"]),
                    this._RSA.importKey("jwk", delegatePubKey, ["encrypt"])
                  ]).then(([ownerImportedKey, delegateImportedKey]) =>
                    Promise.all([
                      this._RSA.encrypt(ownerImportedKey, this._utils.hex2ua(AESKey as string)),
                      this._RSA.encrypt(delegateImportedKey, this._utils.hex2ua(AESKey as string))
                    ])
                  )
                })
                .then(
                  ([ownerKey, delegateKey]) =>
                    (owner.hcPartyKeys![delegateId] = [
                      this._utils.ua2hex(ownerKey),
                      this._utils.ua2hex(delegateKey)
                    ])
                )
                .then(() => {
                  ownerType === "hcp"
                    ? this.hcpartyBaseApi
                        .modifyHealthcareParty(owner as HealthcarePartyDto)
                        .then((hcp: HealthcarePartyDto) => resolve(["hcp", hcp]))
                    : this.patientBaseApi
                        .modifyPatient(owner as PatientDto)
                        .then((pat: PatientDto) => resolve(["patient", pat]))
                })
                .catch(e => reject(e))
            : reject(new Error(`Missing public key for delegate ${delegateId}`))
        })

        // invalidate the hcPartyKeys cache for the delegate hcp (who was not modified, but the view for its
        // id was updated)
        this.hcPartyKeysRequestsCache[delegateId] = genProm.then(() =>
          this.forceGetHcPartyKeysForDelegate(delegateId)
        )
        return genProm.then(res => res[1])
      })
    )
  }

  // noinspection JSUnusedGlobalSymbols
  checkPrivateKeyValidity(hcp: models.HealthcarePartyDto | models.PatientDto): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._RSA
        .importKey("jwk", utils.spkiToJwk(utils.hex2ua(hcp.publicKey!)), ["encrypt"])
        .then(k => this._RSA.encrypt(k, this._utils.utf82ua("shibboleth")))
        .then(cipher => {
          const kp = this._RSA.loadKeyPairNotImported(hcp.id!)
          return this._RSA
            .importKeyPair("jwk", kp.privateKey, "jwk", kp.publicKey)
            .then(ikp => this._RSA.decrypt(ikp.privateKey, new Uint8Array(cipher)))
        })
        .then(plainText => {
          const pt = this._utils.ua2utf8(plainText)
          console.log(pt)
          resolve(pt === "shibboleth")
        })
        .catch(() => resolve(false))
    })
  }

  private throwDetailedExceptionForInvalidParameter(
    argName: string,
    argValue: any,
    methodName: string,
    methodArgs: any
  ) {
    if (argValue) return

    let details = "\nMethod name: icc-crypto-x-api." + methodName + "()\nArguments:"

    if (methodArgs) {
      try {
        const argsArray = [...methodArgs]
        _.each(argsArray, (arg, index) => (details += "\n[" + index + "]: " + JSON.stringify(arg)))
      } catch (ex) {
        details += "; a problem occured while logging arguments details: " + ex
      }
    }

    throw "### THIS SHOULD NOT HAPPEN: " + argName + " has an invalid value: " + argValue + details
  }
}
