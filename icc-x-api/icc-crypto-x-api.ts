import {IccDeviceApi, IccHcpartyApi, IccPatientApi} from '../icc-api'
import {AESUtils} from './crypto/AES'
import {RSAUtils} from './crypto/RSA'
import {ShamirClass} from './crypto/shamir'

import * as _ from 'lodash'
import {
  Delegation,
  Device,
  Document,
  EncryptedEntity,
  EncryptedParentEntity,
  HealthcareParty,
  MaintenanceTask,
  Patient,
  PropertyStub,
  PropertyTypeStub,
  TypedValueObject,
  User,
} from '../icc-api/model/models'
import {b2a, b64_2uas, hex2ua, string2ua, ua2hex, ua2string, ua2utf8, utf8_2ua} from './utils/binary-utils'
import {fold, jwk2spki, notConcurrent, pkcs8ToJwk, spkiToJwk} from './utils'
import {IccMaintenanceTaskXApi} from './icc-maintenance-task-x-api'
import {Storage, StorageUtils} from "./storage/Storage"

interface DelegatorAndKeys {
  delegatorId: string
  key: CryptoKey
  rawKey: string
}

type CachedDataOwner =
  | {
  type: 'patient'
      dataOwner: Patient
    }
  | {
      type: 'device'
      dataOwner: Device
    }
  | {
      type: 'hcp'
      dataOwner: HealthcareParty
    }

export class IccCryptoXApi {
  get crypto(): Crypto {
    return this._crypto
  }

  get shamir(): ShamirClass {
    return this._shamir
  }

  get RSA(): RSAUtils {
    return this._RSA
  }

  get AES(): AESUtils {
    return this._AES
  }

  hcPartyKeysCache: {
    [key: string]: DelegatorAndKeys
  } = {}

  //[delegateId][delegatorId] = delegateEncryptedHcPartyKey
  //for each delegate, it stores the list of delegators and the corresponding delegateEncryptedHcPartyKey (shared HcPartyKey, from delegator to delegate, encrypted with the RSA key of the delegate)
  hcPartyKeysRequestsCache: {
    [delegateId: string]: Promise<{ [key: string]: { [key: string]: { [key: string]: string } } }>
  } = {}

  cacheLastDeletionTimestamp: number | undefined = undefined

  dataOwnerCache: { [key: string]: Promise<CachedDataOwner> } = {}

  emptyHcpCache(hcpartyId: string) {
    delete this.hcPartyKeysRequestsCache[hcpartyId]
    delete this.dataOwnerCache[hcpartyId]
    delete this.dataOwnerCache[hcpartyId]
  }

  /**
   * Gets all delegate encrypted HcParty keys of the delegate with the given `delegateHcPartyId`, and for each key the delegator id
   * If the keys are not cached, they are retrieved from the backend.
   *
   * @param delegateHcPartyId The Health Care Party id
   * @returns  \{delegatorId: delegateEncryptedHcPartyKey\}
   */
  private getEncryptedAesExchangeKeysForDelegate(
    delegateHcPartyId: string
  ): Promise<{ [key: string]: { [key: string]: { [key: string]: string } } }> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.forceGetEncryptedAesExchangeKeysForDelegate(delegateHcPartyId))
    )
  }

  private forceGetEncryptedAesExchangeKeysForDelegate(
    delegateHcPartyId: string
  ): Promise<{ [key: string]: { [key: string]: { [key: string]: string } } }> {
    return Promise.all([
      this.patientBaseApi.getPatientAesExchangeKeysForDelegate(delegateHcPartyId).catch(() => {}),
      this.hcpartyBaseApi.getAesExchangeKeysForDelegate(delegateHcPartyId).catch(() => {}),
      this.deviceBaseApi.getDeviceAesExchangeKeysForDelegate(delegateHcPartyId).catch(() => {}),
    ]).then(([a, b, c]) => ({ ...a, ...b, ...c }))
  }

  keychainLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain.'
  keychainValidityDateLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain-date.'
  hcpPreferenceKeyEhealthCert = 'eHealthCRTCrypt'
  hcpPreferenceKeyEhealthCertDate = 'eHealthCRTDate'
  rsaLocalStoreIdPrefix = 'org.taktik.icure.rsa.'

  private hcpartyBaseApi: IccHcpartyApi
  private patientBaseApi: IccPatientApi
  private deviceBaseApi: IccDeviceApi
  private readonly _crypto: Crypto

  private generateKeyConcurrencyMap: { [key: string]: PromiseLike<HealthcareParty | Patient> }
  private rsaKeyPairs: { [pubKeyFingerprint: string]: { publicKey: CryptoKey; privateKey: CryptoKey } } = {}

  private readonly _AES: AESUtils
  private readonly _RSA: RSAUtils
  private readonly _shamir: ShamirClass
  private readonly _storage: Storage

  constructor(
    host: string,
    headers: { [key: string]: string },
    hcpartyBaseApi: IccHcpartyApi, //Init with a hcparty x api for better performances
    patientBaseApi: IccPatientApi,
    deviceBaseApi: IccDeviceApi,
    crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
    storage?: Storage
  ) {
    this.hcpartyBaseApi = hcpartyBaseApi
    this.patientBaseApi = patientBaseApi
    this.deviceBaseApi = deviceBaseApi
    this._crypto = crypto
    this.generateKeyConcurrencyMap = {}

    this._AES = new AESUtils(crypto)
    this._RSA = new RSAUtils(crypto)
    this._shamir = new ShamirClass(crypto)

    this._storage = storage || new StorageUtils()
  }

  randomUuid() {
    return ((1e7).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      (c) => (Number(c) ^ ((this._crypto.getRandomValues(new Uint8Array(1))! as Uint8Array)[0] & (15 >> (Number(c) / 4)))).toString(16) //Keep that inlined or you will loose the random
    )
  }

  sha256(data: ArrayBuffer | Uint8Array) {
    return this._crypto.subtle.digest('SHA-256', data)
  }

  private async getPublicKeys() {
    return await Object.values(this.rsaKeyPairs).reduce(async (p, rsa) => {
      return (await p).concat([jwk2spki(await this.RSA.exportKey(rsa.publicKey, 'jwk'))])
    }, Promise.resolve([] as string[]))
  }

  encryptShamirRSAKey(hcp: HealthcareParty, notaries: Array<HealthcareParty>, threshold?: number): Promise<HealthcareParty> {
    return this.loadKeyPairImported(hcp.id!).then((keyPair) =>
      this._RSA.exportKey(keyPair.privateKey, 'pkcs8').then(async (exportedKey) => {
        const privateKey = exportedKey as ArrayBuffer
        const nLen = notaries.length
        const shares = nLen == 1 ? [privateKey] : this._shamir.share(ua2hex(privateKey), nLen, threshold || nLen).map((share) => hex2ua(share))
        const publicKeys = await this.getPublicKeys()

        return _.reduce(
          notaries,
          (queue, notary, idx) => {
            return queue.then(async (hcp) => {
              const { owner: hcParty, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(hcp, notary.id!)
              const [publicKeyIdentifier, hcPartyKeys] = Object.entries(aesExchangeKeys)[0]

              try {
                const importedAESHcPartyKey = await this.decryptHcPartyKey(
                  notary.id!,
                  hcParty.id!,
                  notary.id!,
                  publicKeyIdentifier,
                  hcPartyKeys,
                  publicKeys
                )
                const encryptedShamirPartition = await this.AES.encrypt(importedAESHcPartyKey.key, shares[idx])

                hcParty.privateKeyShamirPartitions = hcParty.privateKeyShamirPartitions || {}
                hcParty.privateKeyShamirPartitions[notary.id!] = ua2hex(encryptedShamirPartition)
              } catch (e) {
                console.log('Error during encryptedShamirRSAKey', notary.id, e)
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
  async decryptShamirRSAKey(hcp: HealthcareParty, notaries: Array<HealthcareParty>): Promise<void> {
    try {
      const publicKeys = await this.getPublicKeys()
      const nLen = notaries.length
      let decryptedPrivatedKey
      if (nLen == 1) {
        const notaryHcPartyId = notaries[0].id!
        const encryptedAesKeyMap = await this.getEncryptedAesExchangeKeys(hcp, notaryHcPartyId)
        const importedAESHcPartyKey = await Promise.all(
          Object.entries(encryptedAesKeyMap).map(
            async ([idPubKey, keysMap]) => await this.decryptHcPartyKey(notaryHcPartyId, hcp.id!, notaryHcPartyId, idPubKey, keysMap, publicKeys)
          )
        )
        const cryptedPrivatedKey = hcp.privateKeyShamirPartitions![notaryHcPartyId]
        decryptedPrivatedKey = ua2hex(
          await this.AES.decryptSome(
            importedAESHcPartyKey.map((k) => k.key),
            hex2ua(cryptedPrivatedKey)
          )
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
                const encryptedAesKeyMap = await this.getEncryptedAesExchangeKeys(hcp, notary.id!)
                const importedAESHcPartyKey = await Promise.all(
                  Object.entries(encryptedAesKeyMap).map(
                    async ([idPubKey, keysMap]) => await this.decryptHcPartyKey(notary.id!, hcp.id!, notary.id!, idPubKey, keysMap, publicKeys)
                  )
                )
                const encryptedShare = hcp.privateKeyShamirPartitions![notary.id!]
                const decryptedShamirPartition = ua2hex(
                  await this.AES.decryptSome(
                    importedAESHcPartyKey.map((k) => k.key),
                    hex2ua(encryptedShare)
                  )
                )
                shares.push(decryptedShamirPartition)
              } catch (e) {
                console.log('Error during encryptedShamirRSAKey', notary.id, e)
              }
              return shares
            })
          },
          Promise.resolve([] as string[])
        )

        decryptedPrivatedKey = this._shamir.combine(decryptedShares)
      }

      const importedPrivateKey = await this._RSA.importKey('pkcs8', hex2ua(decryptedPrivatedKey), ['decrypt'])
      const importedPublicKey = await this._RSA.importKey('spki', hex2ua(hcp.publicKey!), ['encrypt'])

      const exportedKeyPair = await this._RSA.exportKeys({ publicKey: importedPublicKey, privateKey: importedPrivateKey }, 'jwk', 'jwk')
      this.storeKeyPair(hcp.id!, exportedKeyPair)
    } catch (e) {
      console.log('Cannot decrypt shamir RSA key')
    }
  }

  /**
   * Gets the decryptedHcPartyKey for the given `encryptedHcPartyKey`
   *
   * If the decrypted key exists in the cache, retrieves it from there.
   * Otherwise, decrypts it using the RSA key of the delegator or delegate (depending on the value of `encryptedForDelegator`)
   *
   * @param loggedHcPartyId The logged DataOwner id or the id of his parent
   * @param delegatorId The id of Delegator eg, the DataOwner where this AES exchange key is stored
   * @param delegateHcPartyId The id of the delegate : the data owner for whom this aes exchange key has been created
   * @param publicKey The public key of the delegator : A unique aes exchange key is created for each public key of the delegator. This is the public key corresponding to the encryptedHcPartyKeys
   * @param encryptedHcPartyKeys The encryptedHcPartyKeys to be decrypted
   * @param publicKeys The public keys for which we might have a private key
   *
   * @returns - **delegatorId** the input param  `delegatorId`
   * - **key** the decrypted `encryptedHcPartyKey`
   */

  async decryptHcPartyKey(
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKey: string,
    encryptedHcPartyKeys: { [key: string]: string },
    publicKeys: string[]
  ): Promise<DelegatorAndKeys> {
    if (!publicKeys.length) {
      const reason = `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId}: no public key`
      console.warn(reason)
      throw new Error(reason)
    }

    const cacheKey = `${delegateHcPartyId}|${publicKey.slice(-32)}|${delegatorId}`
    const res = this.hcPartyKeysCache[cacheKey]

    if (res) {
      return res
    }

    const result = await publicKeys.reduce(async (res, pk) => {
      const delegatorAndKeys = await res
      if (delegatorAndKeys) {
        return delegatorAndKeys
      }

      const fingerprint = pk.slice(-32)
      const keyPair = this.rsaKeyPairs[fingerprint] ?? (await this.cacheKeyPair(this.loadKeyPairNotImported(loggedHcPartyId, fingerprint)))
      if (!keyPair) {
        return
      }

      const encryptedHcPartyKey = encryptedHcPartyKeys[fingerprint]
      if (!encryptedHcPartyKey) {
        return
      }

      try {
        const decryptedAesExchangeKey = await this._RSA.decrypt(keyPair.privateKey, hex2ua(encryptedHcPartyKey))
        const importedAesExchangeKey = await this._AES.importKey('raw', decryptedAesExchangeKey)
        return (this.hcPartyKeysCache[cacheKey] = {
          delegatorId: delegatorId,
          key: importedAesExchangeKey,
          rawKey: ua2hex(new Uint8Array(decryptedAesExchangeKey)),
        })
      } catch (e) {
        const reason = `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId} for pubKey ${fingerprint}: impossible to decrypt`
        console.log(reason)
      }
    }, Promise.resolve() as Promise<DelegatorAndKeys | void>)

    const availablePublicKeys = publicKeys.filter((pk) => this.rsaKeyPairs[pk.slice(-32)])

    if (!result) {
      //Try to find another key from the transfer keys
      const hcp = (await this.getDataOwner(loggedHcPartyId))!
      const candidates = Object.entries(hcp.dataOwner.transferKeys ?? {})
        .filter(([fp, _]) => availablePublicKeys.some((pk) => pk.slice(-32) === fp.slice(-32))) // only keep keys that we will be able to decrypt
        .flatMap(([pk, keys]) => Object.entries(keys).map(([k, v]) => [pk, k, v]))
        .filter(([_, k]) => !publicKeys.some((apk) => apk.slice(-32) === k.slice(-32)))
      if (candidates.length) {
        const newPublicKeys = await candidates.reduce(async (p, [decryptionKeyFingerprint, privateKeyFingerprint, encryptedPrivateKey]) => {
          const newKeys = await p
          const aesExchangeKeys = Object.entries(hcp.dataOwner.aesExchangeKeys!).find(
            ([fp, _]) => fp.slice(-32) === privateKeyFingerprint.slice(-32)
          )?.[1][loggedHcPartyId]
          if (aesExchangeKeys) {
            const encryptedAesExchangeKey = Object.entries(aesExchangeKeys).find(
              ([fp, _]) => fp.slice(-32) === decryptionKeyFingerprint.slice(-32)
            )?.[1]
            if (encryptedAesExchangeKey) {
              const keyPair = this.rsaKeyPairs[decryptionKeyFingerprint.slice(-32)]
              if (!keyPair) {
                return newKeys
              }
              const decryptedAesExchangeKey = await this._RSA.decrypt(keyPair.privateKey, hex2ua(encryptedAesExchangeKey))
              const importedAesExchangeKey = await this._AES.importKey('raw', decryptedAesExchangeKey)

              const decryptedPrivateKey = await this._AES.decrypt(importedAesExchangeKey, hex2ua(encryptedPrivateKey))

              const newPublicKey = Object.keys(hcp.dataOwner.aesExchangeKeys!).find((fp) => fp.slice(-32) === privateKeyFingerprint.slice(-32))!
              await this.cacheKeyPair({
                publicKey: spkiToJwk(hex2ua(newPublicKey)),
                privateKey: pkcs8ToJwk(decryptedPrivateKey),
              })

              return newKeys.concat([newPublicKey])
            }
          }
          return newKeys
        }, Promise.resolve([]) as Promise<string[]>)

        if (newPublicKeys.length) {
          return await this.decryptHcPartyKey(loggedHcPartyId, delegatorId, delegateHcPartyId, publicKey, encryptedHcPartyKeys, newPublicKeys)
        }
      }

      const reason = `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId}: impossible to decrypt. No private key was found or could be used to decrypt the aes exchange keys`
      console.log(reason)
      throw new Error(reason)
    }

    return result
  }

  /**
   * Cache the RSA private/public key pair for the HcP with the given id `hcPartyKeyOwner`
   */
  cacheKeyPair(keyPairInJwk: { publicKey: JsonWebKey; privateKey: JsonWebKey }) {
    return this._RSA.importKeyPair('jwk', keyPairInJwk.privateKey, 'jwk', keyPairInJwk.publicKey).then((importedKeyPair) => {
      const pk = jwk2spki(keyPairInJwk.publicKey)
      return (this.rsaKeyPairs[pk.slice(-32)] = importedKeyPair)
    })
  }

  /**
   * Gets the secret ID (SFKs) that should be used in the prescribed context (confidential or not) from decrypted SPKs of the given `parent`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param parent :the object of which delegations (SPKs) to decrypt
   * @param hcpartyId :the id of the delegate HcP
   * @param confidential :weather the key is going to be used for a confidential piece or data or not
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  async extractPreferredSfk(parent: EncryptedParentEntity, hcpartyId: string, confidential: boolean) {
    const secretForeignKeys = await this.extractSFKsHierarchyFromDelegations(parent, hcpartyId)
    const keys = secretForeignKeys
      .filter(({ extractedKeys }) => extractedKeys.length > 0)
      .filter((x, idx) => (confidential ? x.hcpartyId === hcpartyId : idx === 0))[0]

    return (
      (keys &&
        (confidential
          ? keys.extractedKeys.find(
              (k) => !secretForeignKeys.some(({ extractedKeys, hcpartyId: parentHcpId }) => hcpartyId !== parentHcpId && extractedKeys.includes(k))
            )
          : keys.extractedKeys[0])) ||
      undefined
    )
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
   * @param minCacheDurationInSeconds The minimum cache duration
   * @returns - **delegatorId** : the id of the delegator HcP that shares the **key** with the `delegateHcPartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `delegateHcPartyId`
   */
  async decryptAndImportAesHcPartyKeysForDelegators(
    delegatorsHcPartyIdsSet: Array<string>,
    delegateHcPartyId: string,
    minCacheDurationInSeconds: number = 60
  ): Promise<Array<DelegatorAndKeys>> {
    const aesExchangeKeys = await (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.getEncryptedAesExchangeKeysForDelegate(delegateHcPartyId))
    ).then(async (delegatorIdsWithDelegateEncryptedHcPartyKeys: { [key: string]: { [key: string]: { [key: string]: string } } }) => {
      // [key: delegatorId] = delegateEncryptedHcPartyKey
      // For each delegatorId, obtain the AES key (decrypted HcParty Key) shared with the delegate, decrypted by the delegate
      return (
        await Promise.all(
          delegatorsHcPartyIdsSet.map(async (delegatorId: string) => {
            const encryptedHcPartyKeysForPubKeyFingerprint = delegatorIdsWithDelegateEncryptedHcPartyKeys[delegatorId]
            if (!encryptedHcPartyKeysForPubKeyFingerprint) {
              return [] as DelegatorAndKeys[]
            }
            const decryptedKeys = await Promise.all(
              Object.entries(encryptedHcPartyKeysForPubKeyFingerprint).map(async ([delegatorPubKeyFinerprint, encryptedAesExchangeKeys]) => {
                try {
                  return await this.decryptHcPartyKey(
                    delegateHcPartyId,
                    delegatorId,
                    delegateHcPartyId,
                    delegatorPubKeyFinerprint,
                    encryptedAesExchangeKeys,
                    Object.keys(this.rsaKeyPairs)
                  )
                } catch (e) {
                  console.log(`failed to decrypt hcPartyKey from ${delegatorId} to ${delegateHcPartyId}`)
                  return
                }
              })
            )
            return decryptedKeys.filter((x) => !!x) as DelegatorAndKeys[]
          })
        )
      ).reduce((acc, x) => [...acc, ...x], [])
    })

    if (aesExchangeKeys.length > 0) {
      return aesExchangeKeys
    }

    const nowTimestamp = +new Date()
    if (!this.cacheLastDeletionTimestamp || (nowTimestamp - this.cacheLastDeletionTimestamp) / 1000 >= minCacheDurationInSeconds) {
      delete this.hcPartyKeysRequestsCache[delegateHcPartyId]
      this.cacheLastDeletionTimestamp = nowTimestamp
      return this.decryptAndImportAesHcPartyKeysForDelegators(delegatorsHcPartyIdsSet, delegateHcPartyId, minCacheDurationInSeconds)
    }

    return []
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
   * @param dataOwnerId : the id of the delegate HCP
   * @param delegations : delegations (can be SPKs, CFKs, EKs) for all delegates
   * @param fallbackOnParent  default true; use parent's healthCarePartyId in case there's no delegation for the `healthcarePartyId`
   * @returns  - **delegatorId** : the id of the delegator HcP that shares the **key** with the `healthcarePartyId`
   *  - **key** the decrypted HcPartyKey, shared between **delegatorId** and `healthcarePartyId`
   */
  async getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(
    dataOwnerId: string,
    delegations: { [key: string]: Array<Delegation> },
    fallbackOnParent = true
  ): Promise<Array<DelegatorAndKeys>> {
    const delegationsArray = delegations[dataOwnerId] ?? []

    if (!delegationsArray.length && fallbackOnParent) {
      const { dataOwner: hcp } = await this.getDataOwner(dataOwnerId)
      return (hcp as any).parentId
        ? await this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations((hcp as any).parentId, delegations)
        : []
    } else {
      const delegatorIds = new Set<string>()
      delegationsArray.forEach((del) => delegatorIds.add(del.owner!))
      return this.decryptAndImportAesHcPartyKeysForDelegators(Array.from(delegatorIds), dataOwnerId)
    }
  }

  /**
   * Retrieve the owner HealthCareParty key and use it to encrypt
   * both the delegations (createdObject.id) and the cryptedForeignKeys
   * (parentObject.id), and returns them in an object.
   */
  async initObjectDelegations(
    createdObject: any,
    parentObject: any,
    ownerId: string,
    secretForeignKeyOfParent: string | null
  ): Promise<{
    owner: HealthcareParty | Device | Patient
    delegations: any
    cryptedForeignKeys: any
    secretForeignKeys: any[]
    secretId: string
  }> {
    const publicKeys = await this.getPublicKeys()

    this.throwDetailedExceptionForInvalidParameter('createdObject.id', createdObject.id, 'initObjectDelegations', arguments)

    if (parentObject) this.throwDetailedExceptionForInvalidParameter('parentObject.id', parentObject.id, 'initObjectDelegations', arguments)

    const secretId = this.randomUuid()
    return this.getDataOwner(ownerId).then(async ({ dataOwner: owner }) => {
      const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, ownerId)
      const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, ownerId, publicKeys)

      const encryptedDelegation = await this._AES.encrypt(
        importedAESHcPartyKey.key,
        string2ua(createdObject.id + ':' + secretId).buffer as ArrayBuffer,
        importedAESHcPartyKey.rawKey
      )
      const encryptedSecretForeignKey =
        parentObject &&
        this._AES.encrypt(
          importedAESHcPartyKey.key,
          string2ua(createdObject.id + ':' + parentObject.id).buffer as ArrayBuffer,
          importedAESHcPartyKey.rawKey
        )

      return {
        owner: modifiedOwner,
        delegations: _.fromPairs([
          [
            ownerId,
            [
              {
                owner: ownerId,
                delegatedTo: ownerId,
                key: ua2hex(encryptedDelegation!),
              },
            ],
          ],
        ]),
        cryptedForeignKeys:
          (encryptedSecretForeignKey &&
            _.fromPairs([
              [
                ownerId,
                [
                  {
                    owner: ownerId,
                    delegatedTo: ownerId,
                    key: ua2hex(encryptedSecretForeignKey!),
                  },
                ],
              ],
            ])) ||
          {},
        secretForeignKeys: (secretForeignKeyOfParent && [secretForeignKeyOfParent]) || [],
        secretId: secretId,
      }
    })
  }

  private async decryptAnyAesExchangeKeyForOwner(
    aesExchangeKeys: { [p: string]: { [p: string]: string } },
    loggedHcPartyId: string,
    delegatorId: string,
    delegateHcPartyId: string,
    publicKeys: string[]
  ) {
    const importedAESHcPartyKey = await Object.entries(aesExchangeKeys).reduce(async (acc, [publicKeyIdentifier, hcPartyKeys]) => {
      const accValue = await acc
      if (accValue) {
        return accValue
      }
      try {
        return await this.decryptHcPartyKey(loggedHcPartyId, delegatorId, delegateHcPartyId, publicKeyIdentifier, hcPartyKeys, publicKeys)
      } catch (e) {
        return undefined
      }
    }, Promise.resolve() as Promise<DelegatorAndKeys | undefined>)

    if (!importedAESHcPartyKey) {
      throw new Error(`No hcParty key can be decrypted from ${delegatorId} to ${delegateHcPartyId} using currently available private keys`)
    }
    return importedAESHcPartyKey
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

  extendedDelegationsAndCryptedForeignKeys<T extends EncryptedEntity, P extends EncryptedParentEntity>(
    //TODO: suggested name: getExtendedChildObjectSPKandCFKwithDelegationFromDelegatorToDelegate
    modifiedObject: T,
    parentObject: P | null,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string | null
  ): Promise<{
    modifiedObject: T
    delegations: { [key: string]: Array<Delegation> }
    cryptedForeignKeys: { [key: string]: Array<Delegation> }
    secretId: string | null //TODO: why input parameter secretIdOfModifiedObject is returned?
  }> {
    this.throwDetailedExceptionForInvalidParameter('modifiedObject.id', modifiedObject.id, 'extendedDelegationsAndCryptedForeignKeys', arguments) //modifiedObject should never be null

    if (parentObject)
      this.throwDetailedExceptionForInvalidParameter('parentObject.id', parentObject?.id, 'extendedDelegationsAndCryptedForeignKeys', arguments)

    this.throwDetailedExceptionForInvalidParameter(
      'secretIdOfModifiedObject',
      secretIdOfModifiedObject,
      'extendedDelegationsAndCryptedForeignKeys',
      arguments
    )

    return this.getDataOwner(ownerId)
      .then(async ({ dataOwner: owner }) => {
        const publicKeys = await this.getPublicKeys()
        const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, delegateId)
        const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, delegateId, ownerId, publicKeys)

        modifiedObject = modifiedObject?.id === owner.id ? (modifiedOwner as T) : modifiedObject

        return {
          previousDecryptedDelegations: await Promise.all(
            ((modifiedObject.delegations || {})[delegateId] || []).map(
              (d: Delegation) =>
                (d.key &&
                  d.owner === ownerId &&
                  this._AES.decrypt(importedAESHcPartyKey.key, hex2ua(d.key), importedAESHcPartyKey.rawKey).catch(() => {
                    console.log(
                      `Cannot decrypt delegation from ${d.owner} to ${d.delegatedTo} for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return Promise.resolve()
                  })) ||
                Promise.resolve()
            ) as Array<Promise<ArrayBuffer>>
          ),

          previousDecryptedCryptedForeignKeys: await Promise.all(
            ((modifiedObject.cryptedForeignKeys || {})[delegateId] || []).map(
              (d: Delegation) =>
                (d.key &&
                  d.owner === ownerId &&
                  this._AES.decrypt(importedAESHcPartyKey.key, hex2ua(d.key), importedAESHcPartyKey.rawKey).catch(() => {
                    console.log(
                      `Cannot decrypt cryptedForeignKeys from ${d.owner} to ${d.delegatedTo} for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return Promise.resolve()
                  })) ||
                Promise.resolve()
            ) as Array<Promise<ArrayBuffer>>
          ),

          cryptedDelegation: await this._AES.encrypt(
            importedAESHcPartyKey.key,
            string2ua(modifiedObject.id + ':' + secretIdOfModifiedObject!).buffer as ArrayBuffer,
            importedAESHcPartyKey.rawKey
          ),

          cryptedForeignKey: parentObject
            ? await this._AES.encrypt(
                importedAESHcPartyKey.key,
                string2ua(modifiedObject.id + ':' + parentObject.id).buffer as ArrayBuffer,
                importedAESHcPartyKey.rawKey
              )
            : undefined,
        }
      })
      .then(({ previousDecryptedDelegations, previousDecryptedCryptedForeignKeys, cryptedDelegation, cryptedForeignKey }) => {
        //try to limit the extent of the modifications to the delegations by preserving the redundant delegation already present and removing duplicates
        //For delegate delegateId, we create:
        // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for each existing delegation and the new key concatenated
        // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
        // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
        const delegationCryptedDecrypted = (
          _.merge(
            ((modifiedObject.delegations || {})[delegateId] || []).map((d: Delegation) => ({
              d,
            })),
            (previousDecryptedDelegations || []).map((dd) => (dd ? ua2string(dd) : null)).map((k) => ({ k }))
          ) as { d: Delegation; k: string }[]
        )
          .filter(({ d, k }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
          .map(({ d, k }) => ({
            d,
            k: k || this.randomUuid(),
          })) // Use some unique id that ensures the delegation not created by us are going to be held
          .concat([
            {
              d: {
                owner: ownerId,
                delegatedTo: delegateId,
                key: ua2hex(cryptedDelegation!),
              },
              k: modifiedObject.id + ':' + secretIdOfModifiedObject!,
            },
          ])

        const allDelegations = _.cloneDeep(modifiedObject.delegations || {})

        //Only keep one version of the decrypted key
        allDelegations[delegateId] = _.uniqBy(delegationCryptedDecrypted, (x: any) => x.k).map((x: any) => x.d)

        const cryptedForeignKeysCryptedDecrypted = (
          _.merge(
            ((modifiedObject.cryptedForeignKeys || {})[delegateId] || []).map((d: Delegation) => ({
              d,
            })),
            (previousDecryptedCryptedForeignKeys || []).map((dd) => (dd ? ua2string(dd) : null)).map((k) => ({ k }))
          ) as { d: Delegation; k: string }[]
        )
          .filter(({ d, k }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
          .map(({ d, k }: { d: Delegation; k: string }) => ({
            d,
            k: k || this.randomUuid(),
          })) // Use some unique id that ensures the delegation not created by us are going to be held
          .concat(
            cryptedForeignKey
              ? [
                  {
                    d: {
                      owner: ownerId,
                      delegatedTo: delegateId,
                      key: ua2hex(cryptedForeignKey),
                    },
                    k: modifiedObject.id + ':' + parentObject?.id,
                  },
                ]
              : []
          )

        const allCryptedForeignKeys = _.cloneDeep(modifiedObject.cryptedForeignKeys || {})
        if (cryptedForeignKeysCryptedDecrypted.length > 0) {
          allCryptedForeignKeys[delegateId] = _.uniqBy(cryptedForeignKeysCryptedDecrypted, (x: any) => x.k).map((x: any) => x.d)
        }

        return {
          modifiedObject,
          delegations: allDelegations,
          cryptedForeignKeys: allCryptedForeignKeys,
          secretId: secretIdOfModifiedObject,
        }
      })
  }

  async getEncryptedAesExchangeKeys(
    owner: HealthcareParty | Patient | Device,
    delegateId: string
  ): Promise<{ [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }> {
    const publicKeys = await this.getPublicKeys()
    const mapOfAesExchangeKeys = Object.entries(owner.aesExchangeKeys ?? {})
      .filter((e) => e[1][delegateId] && Object.keys(e[1][delegateId]).some((k1) => publicKeys.some((pk) => pk.endsWith(k1))))
      .reduce((map, e) => {
        const candidates = Object.entries(e[1][delegateId])
        const [publicKeyFingerprint, encryptedAesExchangeKey] = candidates[candidates.findIndex(([k, v]) => publicKeys.some((pk) => pk.endsWith(k)))]
        return { ...map, [e[0]]: { [publicKeyFingerprint]: encryptedAesExchangeKey } }
      }, {} as { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } })

    return !owner.publicKey || mapOfAesExchangeKeys[owner.publicKey] || !owner.hcPartyKeys?.[delegateId]
      ? mapOfAesExchangeKeys
      : { ...mapOfAesExchangeKeys, [owner.publicKey]: { [owner.publicKey.slice(-32)]: owner.hcPartyKeys[delegateId][0] } }
  }

  async getOrCreateHcPartyKeys(
    owner: HealthcareParty | Patient | Device,
    delegateId: string
  ): Promise<{
    owner: HealthcareParty | Patient | Device
    aesExchangeKeys: { [pubKeyIdentifier: string]: { [pubKeyFingerprint: string]: string } }
  }> {
    const aesExchangeKeys = await this.getEncryptedAesExchangeKeys(owner, delegateId)
    if (Object.keys(aesExchangeKeys).length) {
      return { owner, aesExchangeKeys }
    }

    const modifiedOwner = await this.generateKeyForDelegate(owner.id!, delegateId)
    return { owner: modifiedOwner, aesExchangeKeys: await this.getEncryptedAesExchangeKeys(modifiedOwner, delegateId) }
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
    this.throwDetailedExceptionForInvalidParameter('createdObject.id', createdObject.id, 'initEncryptionKeys', arguments)

    const secretId = this.randomUuid()
    return this.getDataOwner(ownerId).then(async ({ dataOwner: owner }) => {
      const publicKeys = await this.getPublicKeys()
      const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, ownerId)
      const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, ownerId, publicKeys)
      const encryptedEncryptionKeys = await this._AES.encrypt(
        importedAESHcPartyKey.key,
        string2ua(createdObject.id + ':' + secretId),
        importedAESHcPartyKey.rawKey
      )

      return {
        encryptionKeys: _.fromPairs([
          [
            ownerId,
            [
              {
                owner: ownerId,
                delegatedTo: ownerId,
                key: ua2hex(encryptedEncryptionKeys),
              },
            ],
          ],
        ]),
        secretId: secretId,
      }
    })
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
  async appendEncryptionKeys(
    //TODO: suggested name: getExtendedEKwithDelegationFromDelegatorToDelegate
    modifiedObject: any,
    ownerId: string,
    delegateId: string,
    secretEncryptionKeyOfObject: string
  ): Promise<{
    encryptionKeys: { [key: string]: Array<Delegation> }
    secretId: string | null //secretEncryptionKeyOfObject is returned to avoid the need for a new decryption when chaining calls
  }> {
    this.throwDetailedExceptionForInvalidParameter('modifiedObject.id', modifiedObject.id, 'appendEncryptionKeys', arguments) //modifiedObject should never be null

    this.throwDetailedExceptionForInvalidParameter('secretEncryptionKeyOfObject', secretEncryptionKeyOfObject, 'appendEncryptionKeys', arguments)

    return this.getDataOwner(ownerId)
      .then(async ({ dataOwner: owner }) => {
        const publicKeys = await this.getPublicKeys()
        const { owner: modifiedOwner, aesExchangeKeys } = await this.getOrCreateHcPartyKeys(owner, delegateId)
        const importedAESHcPartyKey = await this.decryptAnyAesExchangeKeyForOwner(aesExchangeKeys, ownerId, ownerId, delegateId, publicKeys)

        return {
          previousDecryptedEncryptionKeys: await Promise.all(
            ((modifiedObject.encryptionKeys || {})[delegateId] || []).map(
              (d: Delegation) =>
                (d.key &&
                  d.owner === ownerId &&
                  this._AES.decrypt(importedAESHcPartyKey.key, hex2ua(d.key), importedAESHcPartyKey.rawKey).catch(() => {
                    console.log(
                      `Cannot decrypt encryption key from ${d.owner} to ${d.delegatedTo} for object with id ${modifiedObject.id}:`,
                      modifiedObject
                    )
                    return Promise.resolve()
                  })) ||
                Promise.resolve()
            ) as Array<Promise<ArrayBuffer>>
          ),
          encryptedEncryptionKey: await this._AES.encrypt(
            importedAESHcPartyKey.key,
            string2ua(modifiedObject.id + ':' + secretEncryptionKeyOfObject)
          ),
        }
      })
      .then(({ previousDecryptedEncryptionKeys, encryptedEncryptionKey }) => {
        //try to limit the extent of the modifications to the delegations by preserving the redundant encryption keys already present and removing duplicates
        //For delegate delegateId, we create:
        // 1. an array of objects { d : {owner,delegatedTo,encrypted(key)}} with one object for the existing encryption keys and the new key concatenated
        // 2. an array of objects { k : decrypted(key)} with one object for the existing delegations and the new key concatenated
        // We merge them to get one array of objects: { d: {owner,delegatedTo,encrypted(key)}, k: decrypted(key)}
        const encryptionKeysCryptedDecrypted = _.merge(
          ((modifiedObject.encryptionKeys || {})[delegateId] || []).map((d: Delegation) => ({
            d,
          })),
          (previousDecryptedEncryptionKeys || []).map((dd) => (dd ? ua2string(dd) : null)).map((k) => ({ k }))
        )
          .filter(({ d, k }: { d: Delegation; k: string }) => !!k || d.owner !== ownerId) //Only keep the ones created by us that can still be decrypted
          .map(({ d, k }: { d: Delegation; k: string }) => ({ d, k: k || this.randomUuid() }))
          .concat([
            {
              d: {
                owner: ownerId,
                delegatedTo: delegateId,
                key: ua2hex(encryptedEncryptionKey),
              },
              k: modifiedObject.id + ':' + secretEncryptionKeyOfObject!,
            },
          ])

        const allEncryptionKeys = _.cloneDeep(modifiedObject.encryptionKeys)
        allEncryptionKeys[delegateId] = _.uniqBy(encryptionKeysCryptedDecrypted, (x: any) => x.k).map((x: any) => x.d)

        return {
          encryptionKeys: allEncryptionKeys,
          secretId: secretEncryptionKeyOfObject,
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

  addDelegationsAndEncryptionKeys<T extends EncryptedEntity>(
    //TODO: suggested name: updateChildGenericDelegationsFromDelegatorToDelegate
    parent: EncryptedParentEntity | null,
    child: T,
    ownerId: string,
    delegateId: string,
    secretDelegationKey: string | null,
    secretEncryptionKey: string | null
  ): Promise<T> {
    if (parent) this.throwDetailedExceptionForInvalidParameter('parent.id', parent.id, 'addDelegationsAndEncryptionKeys', arguments)

    this.throwDetailedExceptionForInvalidParameter('child.id', child.id, 'addDelegationsAndEncryptionKeys', arguments)
    return (
      secretDelegationKey
        ? this.extendedDelegationsAndCryptedForeignKeys(child, parent, ownerId, delegateId, secretDelegationKey)
        : Promise.resolve({ delegations: {}, cryptedForeignKeys: {} })
    )
      .then((extendedChildObjectSPKsAndCFKs) =>
        secretEncryptionKey
          ? this.appendEncryptionKeys(child, ownerId, delegateId, secretEncryptionKey).then(
              //TODO: extendedDelegationsAndCryptedForeignKeys and appendEncryptionKeys can be done in parallel
              (extendedChildObjectEKs) => ({
                extendedSPKsAndCFKs: extendedChildObjectSPKsAndCFKs,
                extendedEKs: extendedChildObjectEKs,
              })
            )
          : Promise.resolve({
              extendedSPKsAndCFKs: extendedChildObjectSPKsAndCFKs,
              extendedEKs: { encryptionKeys: {} },
            })
      )
      .then(({ extendedSPKsAndCFKs: extendedChildObjectSPKsAndCFKs, extendedEKs: extendedChildObjectEKs }) => {
        return _.assign(child, {
          // Conservative version ... We might want to be more aggressive with the deduplication of keys
          // For each delegate, we are going to concatenate to the src (the new delegations), the object in dest (the current delegations)
          // for which we do not find an equivalent delegation (same delegator, same delegate)
          delegations: _.assignWith(child.delegations, extendedChildObjectSPKsAndCFKs.delegations, (dest, src) =>
            (src || []).concat(
              _.filter(dest, (d: Delegation) => !src.some((s: Delegation) => s.owner === d.owner && s.delegatedTo === d.delegatedTo))
            )
          ),
          cryptedForeignKeys: _.assignWith(child.cryptedForeignKeys, extendedChildObjectSPKsAndCFKs.cryptedForeignKeys, (dest, src) =>
            (src || []).concat(
              _.filter(dest, (d: Delegation) => !src.some((s: Delegation) => s.owner === d.owner && s.delegatedTo === d.delegatedTo))
            )
          ),
          encryptionKeys: _.assignWith(child.encryptionKeys, extendedChildObjectEKs.encryptionKeys, (dest, src) =>
            (src || []).concat(
              _.filter(dest, (d: Delegation) => !src.some((s: Delegation) => s.owner === d.owner && s.delegatedTo === d.delegatedTo))
            )
          ),
        })
      })
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
    document: EncryptedEntity | null,
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
    return this.extractKeysFromDelegationsForHcpHierarchy(hcpartyId, document.id!, delegationsForAllDelegates)
  }

  /**
   * Gets the secret IDs (SFKs) inside decrypted SPKs of the given `document`, decrypted by the HcP with the given `hcpartyId` AND by its HcP parents
   * @param document : the object of which delegations (SPKs) to decrypt
   * @param hcpartyId : the id of the delegate HcP
   * @returns - **extractedKeys** array containing secret IDs (SFKs) from decrypted SPKs, from both given HcP and its parents ; can contain duplicates
   * - **hcpartyId** the given `hcpartyId` OR, if a parent exist, the HcP id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  extractSFKsHierarchyFromDelegations(
    document: EncryptedEntity | null,
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
    return this.extractKeysHierarchyFromDelegationLikes(hcpartyId, document.id!, delegationsForAllDelegates)
  }

  // noinspection JSUnusedGlobalSymbols

  extractCryptedFKs(
    //TODO: suggested name: getSecretIDsCFKofHcpAndParentsFromDocument
    document: EncryptedEntity | null,
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
    return this.extractKeysFromDelegationsForHcpHierarchy(hcpartyId, document.id!, cfksForAllDelegates)
  }

  extractEncryptionsSKs(
    //TODO: suggested name: getSecretIDsEKofHcpAndParentsFromDocument
    document: EncryptedEntity,
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
    return this.extractKeysFromDelegationsForHcpHierarchy(hcpartyId, document.id!, eckeysForAllDelegates)
  }

  extractDelegationsSFKsAndEncryptionSKs(ety: EncryptedEntity, ownerId: string) {
    const delegationsSfksOwnerPromise = this.extractDelegationsSFKs(ety, ownerId).then((xks) => xks.extractedKeys) //Will climb up hierarchy
    const encryptionKeysOwnerPromise = this.extractEncryptionsSKs(ety, ownerId).then((xks) => xks.extractedKeys) //Will climb up hierarchy

    return Promise.all([delegationsSfksOwnerPromise, encryptionKeysOwnerPromise])
  }

  /**
   * Get decrypted generic secret IDs (secretIdSPKs, parentIds, secretIdEKs) from generic delegations (SPKs, CFKs, EKs)
   * 1. Get HealthCareParty from it's Id.
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
  async extractKeysHierarchyFromDelegationLikes(
    //TODO suggested name: getSecretIdsOfHcpAndParentsFromGenericDelegations
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<Delegation> }
  ): Promise<Array<{ hcpartyId: string; extractedKeys: Array<string> }>> {
    const { dataOwner: hcp } = await this.getDataOwner(hcpartyId)
    const extractedKeys = []
    if (delegations[hcpartyId]?.length) {
      const decryptedAndImportedAesHcPartyKeys = await this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(
        hcpartyId,
        delegations,
        false
      )
      const collatedAesKeysFromDelegatorToHcpartyId = decryptedAndImportedAesHcPartyKeys.reduce((map, k) => ({ ...map, [k.delegatorId]: k }), {})
      extractedKeys.push(...(await this.decryptKeyInDelegationLikes(delegations[hcpartyId], collatedAesKeysFromDelegatorToHcpartyId, objectId)))
    }

    return (hcp as HealthcareParty).parentId
      ? [
          ...(await this.extractKeysHierarchyFromDelegationLikes((hcp as HealthcareParty).parentId!, objectId, delegations)),
          { extractedKeys: extractedKeys, hcpartyId: hcpartyId },
        ]
      : [{ extractedKeys: extractedKeys, hcpartyId: hcpartyId }]
  }

  /**
   * Get decrypted generic secret IDs (secretIdSPKs, parentIds, secretIdEKs) from generic delegations (SPKs, CFKs, EKs)
   * 1. Get Data Owner (HCP, Patient or Device) from it's Id.
   * 2. Decrypt the keys of the given data owner.
   * 3. Decrypt the parent's key if it has parent.
   * 4. Return the decrypted key corresponding to the Health Care Party.
   * @param dataOwnerId : the id of the delegate data owner (including its parents) for which to decrypt `extractedKeys`
   * @param objectId : the id of the object/document of which delegations to decrypt ; used just to log to console a message (Cryptographic mistake) in case the object id inside SPK, CFK, EK is different from this one
   * @param delegations : generic delegations (can be SPKs, CFKs, EKs) for all delegates from where to extract `extractedKeys`
   * @returns - **extractedKeys** array containing secret IDs from decrypted generic delegations, from both data owner with given `dataOwnerId` and its parents; can contain duplicates
   * - **dataOwnerId** the given `dataOwnerId` OR, if a parent exist, the data owner id of the top parent in the hierarchy  (even if that parent has no delegations)
   */
  //TODO: even if there are no delegations for parent HCP (but the parent exists), the returned dataOwnerId will be the one of the parent
  extractKeysFromDelegationsForHcpHierarchy(
    //TODO suggested name: getSecretIdsOfHcpAndParentsFromGenericDelegations
    dataOwnerId: string,
    objectId: string,
    delegations: { [key: string]: Array<Delegation> }
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    return this.getDataOwner(dataOwnerId).then(({ dataOwner: hcp }) =>
      (delegations[dataOwnerId] && delegations[dataOwnerId].length
        ? this.getDecryptedAesExchangeKeysOfDelegateAndParentsFromGenericDelegations(dataOwnerId, delegations, false).then(
            (decryptedAndImportedAesHcPartyKeys) => {
              const collatedAesKeysFromDelegatorToHcpartyId: {
                [key: string]: { key: CryptoKey; rawKey: string }[]
              } = {}
              decryptedAndImportedAesHcPartyKeys.forEach((k) => {
                ;(collatedAesKeysFromDelegatorToHcpartyId[k.delegatorId] ?? (collatedAesKeysFromDelegatorToHcpartyId[k.delegatorId] = [])).push(k)
              })
              return this.decryptKeyInDelegationLikes(delegations[dataOwnerId], collatedAesKeysFromDelegatorToHcpartyId, objectId!)
            }
          )
        : Promise.resolve([])
      ).then((extractedKeys) =>
        (hcp as HealthcareParty).parentId
          ? this.extractKeysFromDelegationsForHcpHierarchy((hcp as HealthcareParty).parentId!, objectId, delegations).then((parentResponse) =>
              _.assign(parentResponse, {
                extractedKeys: parentResponse.extractedKeys.concat(extractedKeys),
              })
            )
          : { extractedKeys: extractedKeys, hcpartyId: dataOwnerId }
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
  async decryptKeyInDelegationLikes(
    //TODO: suggested name: getSecretIdsFromGenericDelegations
    delegationsArray: Array<Delegation>,
    aesKeysForDataOwnerId: { [key: string]: { key: CryptoKey; rawKey: string }[] },
    masterId: string
  ): Promise<Array<string>> {
    const decryptPromises: Array<Promise<string | undefined>> = delegationsArray.map(async (genericDelegationItem) => {
      const aesKeys = aesKeysForDataOwnerId[genericDelegationItem.owner!]
      if (aesKeys?.length) {
        return aesKeys.reduce(async (acc, aesKey) => {
          const accValue = await acc
          if (accValue) {
            return accValue
          }
          try {
            const decryptedGenericDelegationKey = await this._AES.decrypt(aesKey.key, hex2ua(genericDelegationItem.key!), aesKey.rawKey)
            const results = ua2string(decryptedGenericDelegationKey).split(':')

            const objectId = results[0] //must be the ID of the object, for checksum
            const genericSecretId = results[1]

            const details =
              'object ID: ' + masterId + '; generic delegation from ' + genericDelegationItem.owner + ' to ' + genericDelegationItem.delegatedTo

            if (!objectId) console.warn('Object id is empty; ' + details)
            if (!genericSecretId) console.warn('Secret id is empty; ' + details)

            if (objectId !== masterId) {
              /*console.log(
                "Cryptographic mistake: object ID is not equal to the expected concatenated id within decrypted generic delegation. This may happen when patients have been merged; " +
                  details
              )*/
            }
            return genericSecretId
          } catch (err) {
            console.log(
              `Could not decrypt generic delegation in object with ID: ${masterId} from ${genericDelegationItem.owner} to ${genericDelegationItem.delegatedTo}: ${err}`
            )
            console.log(`AES key is: ${aesKey.rawKey}. Encrypted data is ${genericDelegationItem.key}.`)

            return undefined
          }
        }, Promise.resolve() as Promise<string | undefined>)
      } else {
        console.log(`Could not find aes key for object with ID: ${masterId}`)
      }
    })
    return Promise.all(decryptPromises).then((genericSecretId) => genericSecretId.filter((id) => !!id) as string[])
  }

  getPublicKeyFromPrivateKey(privateKey: JsonWebKey, dataOwner: Patient | Device | HealthcareParty) {
    if (!privateKey.n || !privateKey.e) {
      throw new Error('No public key can be deduced from incomplete private key')
    }

    const publicKeyFromPrivateKey = jwk2spki(privateKey)
    const publicKeys = [dataOwner.publicKey].concat(Object.keys(dataOwner.aesExchangeKeys ?? {})).filter((x) => !!x)

    if (!publicKeys.length) {
      throw new Error('No public key has been defined for hcp')
    }

    const publicKey = publicKeys.find((it) => it === publicKeyFromPrivateKey)
    if (!publicKey) {
      throw new Error('No public key can be found for this private key')
    }

    return publicKey
  }

  async loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    const { dataOwner } = await this.getDataOwner(healthcarePartyId)

    const privateKeyInJwk = pkcs8ToJwk(privateKey)
    const publicKey = this.getPublicKeyFromPrivateKey(privateKeyInJwk, dataOwner)

    const keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } = await this._RSA.importKeyPair(
      'jwk',
      privateKeyInJwk,
      'jwk',
      spkiToJwk(hex2ua(publicKey))
    )
    this.rsaKeyPairs[healthcarePartyId] = keyPair
    const exportedKeyPair = await this._RSA.exportKeys(keyPair, 'jwk', 'jwk')

    return this.storeKeyPair(`${healthcarePartyId}.${publicKey.slice(-32)}`, exportedKeyPair)
  }

  async loadKeyPairsAsJwkInBrowserLocalStorage(healthcarePartyId: string, privateKey: JsonWebKey) {
    const { dataOwner } = await this.getDataOwner(healthcarePartyId)

    if ((!privateKey.n || !privateKey.e) && dataOwner.publicKey) {
      //Fallback on default publicKey
      console.warn('An incomplete key has been completed using the default public key of the data owner')
      const publicKeyInJwk = spkiToJwk(hex2ua(dataOwner.publicKey))
      privateKey.n = publicKeyInJwk.n
      privateKey.e = publicKeyInJwk.e
    }

    const publicKey = this.getPublicKeyFromPrivateKey(privateKey, dataOwner)

    const keyPair = await this._RSA.importKeyPair('jwk', privateKey, 'jwk', spkiToJwk(hex2ua(publicKey)))
    this.rsaKeyPairs[healthcarePartyId] = keyPair
    const exportedKeyPair = await this._RSA.exportKeys(keyPair, 'jwk', 'jwk')

    return this.storeKeyPair(`${healthcarePartyId}.${publicKey.slice(-32)}`, exportedKeyPair)
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeyPairsInBrowserLocalStorage(healthcarePartyId: string, file: Blob): Promise<void> {
    const fr = new FileReader()
    return new Promise((resolve, reject) => {
      fr.onerror = reject
      fr.onabort = reject
      fr.onload = (e: any) => {
        //TODO remove any
        const privateKey = e.target.result as string
        this.loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId, hex2ua(privateKey))
          .then(() => resolve())
          .catch(reject)
      }
      fr.readAsText(file)
    })
  }

  // noinspection JSUnusedGlobalSymbols
  saveKeychainInBrowserLocalStorage(id: string, keychain: number) {
    this._storage.setItem(
      this.keychainLocalStoreIdPrefix + id,
      b2a(new Uint8Array(keychain).reduce((data, byte) => data + String.fromCharCode(byte), ''))
    )
  }

  saveKeychainInBrowserLocalStorageAsBase64(id: string, keyChainB64: string) {
    this._storage.setItem(this.keychainLocalStoreIdPrefix + id, keyChainB64)
  }

  // noinspection JSUnusedGlobalSymbols
  saveKeychainValidityDateInBrowserLocalStorage(id: string, date: string) {
    if (!id) return

    if (!date) {
      this._storage.removeItem(this.keychainValidityDateLocalStoreIdPrefix + id)
    } else {
      this._storage.setItem(this.keychainValidityDateLocalStoreIdPrefix + id, date)
    }
  }

  /**
   * Populate the HCP.options dict with an encrypted eHealth certificate and unencryped expiry date.
   * Any potentially unencrypted certificates will be pruned from the HCP.
   * @param hcpId Id of the hcp to modify
   * @returns modified HCP
   */
  async saveKeyChainInHCPFromLocalStorage(hcpId: string): Promise<HealthcareParty> {
    return await this.hcpartyBaseApi.getHealthcareParty(hcpId).then(async (hcp: HealthcareParty) => {
      let aesKey: CryptoKey | null = null
      try {
        aesKey = _.find(
          await this.decryptAndImportAesHcPartyKeysForDelegators([hcp.id!], hcp.id!),
          (delegator: DelegatorAndKeys) => delegator.delegatorId === hcp.id
        )!.key
      } catch (e) {
        console.error('Error while importing the AES key.')
      }
      if (!aesKey) {
        console.error('No encryption key!')
      }

      const opts = hcp.options || {}

      const crt = this.getKeychainInBrowserLocalStorageAsBase64(hcp.id!!)
      if (!!aesKey && !!crt) {
        let crtEncrypted: ArrayBuffer | null = null
        try {
          crtEncrypted = await this.AES.encrypt(aesKey, new Uint8Array(string2ua(atob(crt))))
        } catch (e) {
          console.error('Error while encrypting the certificate', e)
        }

        // add the encrypted certificate to the options
        _.set(opts, this.hcpPreferenceKeyEhealthCert, ua2string(new Uint8Array(crtEncrypted!)))
      }

      const crtValidityDate = this.getKeychainValidityDateInBrowserLocalStorage(hcp.id!!)
      if (!!crtValidityDate) {
        _.set(opts, this.hcpPreferenceKeyEhealthCertDate, crtValidityDate)
      }

      hcp.options = opts
      return hcp
    })
  }

  importKeychainInBrowserFromHCP(hcpId: string): Promise<void> {
    return this.hcpartyBaseApi.getHealthcareParty(hcpId).then(async (hcp: HealthcareParty) => {
      let crtCryp: Uint8Array | null = null
      if (!!hcp.options && !!hcp.options[this.hcpPreferenceKeyEhealthCert]) {
        crtCryp = string2ua(hcp.options[this.hcpPreferenceKeyEhealthCert])
      }

      const crtValidityDate = _.get(hcp.options, this.hcpPreferenceKeyEhealthCertDate)

      // store the validity date
      if (!!crtValidityDate) {
        this.saveKeychainValidityDateInBrowserLocalStorage(hcp.id!!, crtValidityDate)
      }

      let crt: ArrayBuffer | null = null
      let decryptionKey: CryptoKey | null = null
      try {
        decryptionKey = _.find(
          await this.decryptAndImportAesHcPartyKeysForDelegators([hcp.id!], hcp.id!),
          (delegator: DelegatorAndKeys) => delegator.delegatorId === hcp.id
        )!.key
      } catch (e) {
        console.error('Error while importing the AES key.')
      }
      if (!decryptionKey) {
        throw new Error('No encryption key! eHealth certificate cannot be decrypted.')
      }

      if (!!crtCryp && decryptionKey) {
        try {
          crt = await this.AES.decrypt(decryptionKey, crtCryp)
        } catch (e) {
          console.error(e)
        }
      }

      if (!crt) {
        throw new Error(`Error while saving certificate in browser local storage! Hcp ${hcp.id} has no certificate.`)
      } else {
        this.saveKeychainInBrowserLocalStorageAsBase64(hcp.id!!, btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(crt)))))
      }

      return
    })
  }

  /**
   * Synchronizes the eHealth certificate from the database into the LocalStorage, returning information on the presence
   * of certificate data in either place.
   *
   * @param hcpId The healthcare party id
   * @returns A Promise for an object that represents the existence of a certificate in local storage and in the DB,
   * through the two boolean properties "local" and "remote".
   */
  syncEhealthCertificateFromDatabase(hcpId: string): Promise<{ remote: boolean; local: boolean }> {
    return this.hcpartyBaseApi.getHealthcareParty(hcpId).then((hcp: HealthcareParty) => {
      const remoteCertificate = _.get(hcp.options, this.hcpPreferenceKeyEhealthCert)
      const localCertificate = this.getKeychainInBrowserLocalStorageAsBase64(hcp.id!)

      if (remoteCertificate) {
        return this.importKeychainInBrowserFromHCP(hcp.id!)
          .then(() => ({ local: true, remote: true }))
          .catch(() => ({ local: !!localCertificate, remote: true }))
      } else {
        return { local: !!localCertificate, remote: !!remoteCertificate }
      }
    })
  }

  getKeychainInBrowserLocalStorageAsBase64(id: string) {
    return this._storage.getItem(this.keychainLocalStoreIdPrefix + id)
  }

  getKeychainValidityDateInBrowserLocalStorage(id: string) {
    return this._storage.getItem(this.keychainValidityDateLocalStoreIdPrefix + id)
  }

  // noinspection JSUnusedGlobalSymbols
  loadKeychainFromBrowserLocalStorage(id: string) {
    const lsItem = this._storage.getItem('org.taktik.icure.ehealth.keychain.' + id)
    return lsItem !== null ? b64_2uas(lsItem) : null
  }

  /**
   *
   * @param id
   * @param keyPair should be JWK
   */
  storeKeyPair(id: string, keyPair: { publicKey: any; privateKey: any }) {
    if (typeof Storage === 'undefined') {
      console.log('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    //TODO encryption
    this._storage.setItem(this.rsaLocalStoreIdPrefix + id, JSON.stringify(keyPair))
  }

  /**
   * loads the RSA key pair (hcparty) in JWK from local storage, not imported
   *
   * @param id  doc id - hcpartyId
   * @param publicKeyFingerPrint the 32 last characters of public key this private key is associated with
   * @returns {Object} it is in JWK - not imported
   */
  loadKeyPairNotImported(id: string, publicKeyFingerPrint?: string): { publicKey: JsonWebKey; privateKey: JsonWebKey } {
    if (typeof Storage === 'undefined') {
      console.log('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    //TODO decryption
    const item =
      (publicKeyFingerPrint && this._storage.getItem(this.rsaLocalStoreIdPrefix + id + '.' + publicKeyFingerPrint)) ??
      this._storage.getItem(this.rsaLocalStoreIdPrefix + id)
    if (!item) {
      console.warn(`No key can be found in local storage for id ${id} and publicKeyFingerPrint ${publicKeyFingerPrint}`)
    }
    return JSON.parse(item!)
  }

  /**
   * Loads and imports the RSA key pair (hcparty) from local storage
   *
   * @param id  doc id - hcPartyId
   * @returns {Promise} -> {CryptoKey} - imported RSA
   */
  loadKeyPairImported(id: string) {
    return new Promise((resolve: (value: { publicKey: CryptoKey; privateKey: CryptoKey }) => any, reject) => {
      try {
        const jwkKey = this._storage.getItem(this.rsaLocalStoreIdPrefix + id) as string
        if (jwkKey) {
          const jwkKeyPair = JSON.parse(jwkKey)
          if (jwkKeyPair.publicKey && jwkKeyPair.privateKey) {
            this._RSA.importKeyPair('jwk', jwkKeyPair.privateKey, 'jwk', jwkKeyPair.publicKey).then(resolve, (err) => {
              console.log('Error in RSA.importKeyPair: ' + err)
              reject(err)
            })
          } else {
            const message = 'Error in RSA.importKeyPair: Invalid key'
            console.log(message)
            reject(Error(message))
          }
        } else {
          const message = 'Error in RSA.importKeyPair: Missing key'
          console.log(message)
          reject(Error(message))
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  async addNewKeyPairForOwnerId(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    ownerId: string,
    generateTransferKey: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    return this.addNewKeyPairForOwner(maintenanceTasksApi, user, await this.getDataOwner(ownerId), generateTransferKey)
  }

  async addNewKeyPairForOwner(
    maintenanceTasksApi: IccMaintenanceTaskXApi,
    user: User,
    cdo: CachedDataOwner,
    generateTransferKey: boolean = true
  ): Promise<{ dataOwner: HealthcareParty | Patient | Device; publicKey: string; privateKey: string }> {
    const { publicKey, privateKey } = await this.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await this.RSA.exportKey(publicKey!, 'spki'))

    const gen = (await this._AES.generateCryptoKey(true)) as string

    await this.cacheKeyPair({ publicKey: await this.RSA.exportKey(publicKey!, 'jwk'), privateKey: await this.RSA.exportKey(privateKey!, 'jwk') })

    const { type: ownerType, dataOwner: ownerToUpdate } = await this.createOrUpdateAesExchangeKeysFor(cdo, gen, {
      pubKey: publicKey,
      privKey: privateKey,
    }).then((dataOwnerWithUpdatedAesKeys) =>
      generateTransferKey
        ? this.createOrUpdateTransferKeysFor(dataOwnerWithUpdatedAesKeys, gen, { pubKey: publicKey, privKey: privateKey })
        : dataOwnerWithUpdatedAesKeys
    )

    const modifiedDataOwnerAndType =
      ownerType === 'hcp'
        ? await (this.dataOwnerCache[ownerToUpdate.id!] = this.hcpartyBaseApi
            .modifyHealthcareParty(ownerToUpdate as HealthcareParty)
            .then((x) => ({ type: 'hcp', dataOwner: x } as CachedDataOwner)))
        : ownerType === 'patient'
        ? await (this.dataOwnerCache[ownerToUpdate.id!] = this.patientBaseApi
            .modifyPatient(ownerToUpdate as Patient)
            .then((x) => ({ type: 'patient', dataOwner: x } as CachedDataOwner)))
        : await (this.dataOwnerCache[ownerToUpdate.id!] = this.deviceBaseApi
            .updateDevice(ownerToUpdate as Device)
            .then((x) => ({ type: 'device', dataOwner: x } as CachedDataOwner)))

    const sentMaintenanceTasks = await this.sendMaintenanceTasks(maintenanceTasksApi, user, modifiedDataOwnerAndType.dataOwner, publicKey)

    return {
      dataOwner: sentMaintenanceTasks.length
        ? await this.retrieveDataOwnerInfoAfterPotentialUpdate(modifiedDataOwnerAndType.dataOwner)
        : modifiedDataOwnerAndType.dataOwner,
      publicKey: publicKeyHex,
      privateKey: ua2hex((await this.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer),
    }
  }

  private async createOrUpdateAesExchangeKeysFor(
    cdo: CachedDataOwner,
    decryptedAesExchangeKey: string,
    keyToEncrypt: { pubKey: CryptoKey; privKey: CryptoKey }
  ): Promise<CachedDataOwner> {
    const publicKeyHex = ua2hex(await this.RSA.exportKey(keyToEncrypt.pubKey!, 'spki'))
    const existingAesExchangeKeys = cdo.dataOwner.aesExchangeKeys ?? {}
    existingAesExchangeKeys[publicKeyHex] = await this.encryptAesKeyFor(decryptedAesExchangeKey, cdo.dataOwner, keyToEncrypt.pubKey)

    return { type: cdo.type, dataOwner: { ...cdo.dataOwner, aesExchangeKeys: existingAesExchangeKeys } } as CachedDataOwner
  }

  private async createOrUpdateTransferKeysFor(
    dataOwner: CachedDataOwner,
    decryptedAesExchangeKey: string,
    keyToEncrypt: { pubKey: CryptoKey; privKey: CryptoKey }
  ): Promise<CachedDataOwner> {
    const pubKeyToEncryptHex = ua2hex(await this.RSA.exportKey(keyToEncrypt.pubKey, 'spki'))

    const encryptedKey = ua2hex(
      await this._AES.encrypt(
        await this._AES.importKey('raw', hex2ua(decryptedAesExchangeKey)),
        (await this.RSA.exportKey(keyToEncrypt.privKey!, 'pkcs8')) as ArrayBuffer,
        decryptedAesExchangeKey
      )
    )

    const dataOwnerExistingPubKeys = Array.from(await this.getDataOwnerHexPublicKeys(dataOwner.dataOwner))

    const transferKeys = fold(dataOwnerExistingPubKeys, dataOwner.dataOwner.transferKeys ?? {}, (pubAcc, pubKeyHex) => {
      if (pubKeyHex !== pubKeyToEncryptHex) {
        const existingKeys = pubAcc[pubKeyHex] ?? {}
        existingKeys[pubKeyToEncryptHex] = encryptedKey
        pubAcc[pubKeyHex] = existingKeys
      }
      return pubAcc
    })

    return { type: dataOwner.type, dataOwner: { ...dataOwner.dataOwner, transferKeys: transferKeys } } as CachedDataOwner
  }

  private async encryptAesKeyFor(
    aesKey: string,
    dataOwner: HealthcareParty | Patient | Device,
    doNewPublicKey: CryptoKey
  ): Promise<{ [delId: string]: { [pk: string]: string } }> {
    const dataOwnerAllPubKeys = [doNewPublicKey].concat(await this.getDataOwnerPublicKeys(dataOwner))

    const encrAes: { [pubKeyFingerprint: string]: string } = {}
    for (const pubKey of dataOwnerAllPubKeys) {
      encrAes[ua2hex(await this.RSA.exportKey(pubKey, 'spki')).slice(-32)] = ua2hex(await this._RSA.encrypt(pubKey, hex2ua(aesKey)))
    }

    return { [dataOwner.id!]: encrAes }
  }

  private retrieveDataOwnerInfoAfterPotentialUpdate(dataOwnerToUpdate: HealthcareParty | Patient | Device): Promise<CachedDataOwner> {
    return this.getDataOwner(dataOwnerToUpdate.id!).then(({ type, dataOwner }) => {
      return {
        type: type,
        dataOwner: {
          ...dataOwner,
          transferKeys: dataOwnerToUpdate.transferKeys,
          hcPartyKeys: fold(Object.entries(dataOwnerToUpdate.hcPartyKeys ?? {}), dataOwner.hcPartyKeys ?? {}, (acc, [delegateId, hcKeys]) => {
            acc[delegateId] = hcKeys
            return acc
          }),
          aesExchangeKeys: fold(
            Object.entries(dataOwnerToUpdate.aesExchangeKeys ?? {}),
            dataOwner.aesExchangeKeys ?? {},
            (pubAcc, [pubKey, newAesExcKeys]) => {
              const existingKeys = pubAcc[pubKey] ?? {}
              pubAcc[pubKey] = fold(Object.entries(newAesExcKeys), existingKeys, (delAcc, [delId, delKeys]) => {
                delAcc[delId] = delKeys
                return delAcc
              })
              return pubAcc
            }
          ),
        },
      } as CachedDataOwner
    })
  }

  private async sendMaintenanceTasks(
    maintenanceTaskApi: IccMaintenanceTaskXApi,
    user: User,
    dataOwner: HealthcareParty | Patient | Device,
    newPublicKey: CryptoKey
  ): Promise<MaintenanceTask[]> {
    const hexNewPubKey = ua2hex(await this.RSA.exportKey(newPublicKey, 'spki'))
    const nonAccessiblePubKeys = Array.from(this.getDataOwnerHexPublicKeys(dataOwner).values())
      .filter((existingPubKey) => existingPubKey != hexNewPubKey)
      .filter(
        (existingPubKey) =>
          !Object.values(this.rsaKeyPairs).find(
            async ({ publicKey, privateKey }) => ua2hex(await this.RSA.exportKey(publicKey, 'spki')) == existingPubKey
          )
      )

    if (nonAccessiblePubKeys.length) {
      const tasksForDelegates = Object.entries(await this.getEncryptedAesExchangeKeysForDelegate(dataOwner.id!))
        .filter(([delegatorId]) => delegatorId != dataOwner.id)
        .flatMap(([delegatorId, delegatorKeys]) => {
          return Object.entries(delegatorKeys).flatMap(([, aesExchangeKeys]) => {
            return Object.keys(aesExchangeKeys).map((delegatePubKey) => {
              return { delegateId: delegatorId, maintenanceTask: this.createMaintenanceTask(dataOwner, delegatePubKey) }
            })
          })
        })

      const tasksForDelegator = Object.entries(await this.getEncryptedAesExchangeKeys(dataOwner, dataOwner.id!)).flatMap(
        ([doPubKey, delegateKeys]) => {
          return Object.keys(delegateKeys)
            .filter((delegateId) => delegateId != dataOwner.id)
            .map((delegateId) => {
              return { delegateId: delegateId, maintenanceTask: this.createMaintenanceTask(dataOwner, doPubKey) }
            })
        }
      )

      return Promise.all(
        tasksForDelegates
          .concat(tasksForDelegator)
          .map(async ({ delegateId, maintenanceTask }) => {
            const taskToCreate = await maintenanceTaskApi?.newInstance(user, maintenanceTask, delegateId)
            return taskToCreate ? maintenanceTaskApi?.createMaintenanceTaskWithUser(user, taskToCreate) : undefined
          })
          .filter((createdTask) => createdTask != undefined)
      )
    } else {
      return []
    }
  }

  private createMaintenanceTask(concernedDataOwner: HealthcareParty | Patient | Device, concernedPubKey: string) {
    return new MaintenanceTask({
      id: this.randomUuid(),
      taskType: 'updateAesExchangeKey',
      status: MaintenanceTask.StatusEnum.Pending,
      properties: [
        new PropertyStub({
          id: 'dataOwnerConcernedId',
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: concernedDataOwner.id,
          }),
        }),
        new PropertyStub({
          id: 'dataOwnerConcernedPubKey',
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: concernedPubKey,
          }),
        }),
      ],
    })
  }

  private getDataOwnerHexPublicKeys(dataOwner: HealthcareParty | Patient | Device): Set<string> {
    return new Set(
      (dataOwner.publicKey ? [dataOwner.publicKey] : [])
        .concat(dataOwner.aesExchangeKeys ? Object.keys(dataOwner.aesExchangeKeys) : [])
        .filter((pubKey) => !!pubKey)
    )
  }

  private async getDataOwnerPublicKeys(dataOwner: HealthcareParty | Patient | Device): Promise<CryptoKey[]> {
    return await Promise.all(
      Array.from(this.getDataOwnerHexPublicKeys(dataOwner)).map(
        async (pubKey) => await this._RSA.importKey('jwk', spkiToJwk(hex2ua(pubKey)), ['encrypt'])
      )
    )
  }

  generateKeyForDelegate(ownerId: string, delegateId: string): PromiseLike<HealthcareParty | Patient> {
    //Preload hcp and patient because we need them and they are going to be invalidated from the caches
    return notConcurrent(this.generateKeyConcurrencyMap, ownerId, async () => {
      const [{ type: ownerType, dataOwner: owner }, { dataOwner: delegate }] = await Promise.all([
        this.getDataOwner(ownerId),
        this.getDataOwner(delegateId),
      ])

      const ownerLegacyPublicKey = owner.publicKey

      const availablePublicKeysFingerprints = Object.keys(this.rsaKeyPairs)
      const availableOwnerPublicKeys = [
        ownerLegacyPublicKey,
        ...Object.keys(owner.aesExchangeKeys || {}).filter((x) => x !== ownerLegacyPublicKey),
      ].filter((k) => !!k && availablePublicKeysFingerprints.some((fp) => k.endsWith(fp))) as string[]
      const selectedPublicKey = availableOwnerPublicKeys[0]

      if (!selectedPublicKey) {
        throw new Error(`Invalid owner, no public key, keypairs have not be set for ${ownerId}`)
      }

      if (
        (owner.hcPartyKeys || {})[delegateId] ||
        Object.values(owner.aesExchangeKeys || {}).some(
          (x) => x[delegateId] && Object.keys(x[delegateId]).some((k) => availablePublicKeysFingerprints.includes(k))
        )
      ) {
        return owner
      }

      let ownerCombinedAesExchangeKeys = owner.aesExchangeKeys ?? {}

      if (ownerLegacyPublicKey && !(owner.aesExchangeKeys ?? {})[ownerLegacyPublicKey]) {
        //Transfer keys from old structure (hcparty keys) to new one (aesExchangeKeys)
        const unknownDataOwnerCounterPartIds = Object.keys(owner.hcPartyKeys ?? {}).filter((x) => x !== ownerId && x !== delegateId)
        const counterParts = [
          owner,
          delegate,
          ...(await Promise.all(unknownDataOwnerCounterPartIds.map((cpid) => this.getDataOwner(cpid).then((dot) => dot.dataOwner)))),
        ]
        ownerCombinedAesExchangeKeys = {
          [ownerLegacyPublicKey]: Object.entries(owner.hcPartyKeys ?? {}).reduce(
            (map, [hcpId, keys]) => ({
              ...map,
              [hcpId]: { [ownerLegacyPublicKey]: keys[0], [counterParts.find((x) => x.id === hcpId)?.publicKey ?? '']: keys[1] },
              ...{},
            }),
            {}
          ),
          ...ownerCombinedAesExchangeKeys,
        }
      }

      const delegatePublicKeys = [delegate.publicKey, ...Object.keys(delegate.aesExchangeKeys ?? {}).filter((x) => x !== delegate.publicKey)].filter(
        (x) => !!x
      ) as string[]
      if (!delegatePublicKeys.length) {
        throw new Error(`Invalid delegate, no public key, keypairs have not be set for ${delegateId}`)
      }
      const genProm = this._AES.generateCryptoKey(true).then(async (AESKey) => {
        const allPubKeys = [...availableOwnerPublicKeys, ...delegatePublicKeys]
        const encryptedAesKeys = await allPubKeys.reduce(
          async (map, pubK) => ({
            ...(await map),
            [pubK.slice(-32)]: ua2hex(
              await this._RSA.encrypt(await this._RSA.importKey('jwk', spkiToJwk(hex2ua(pubK)), ['encrypt']), hex2ua(AESKey as string))
            ),
          }),
          Promise.resolve({} as { [pubKey: string]: string })
        )

        if (delegate.publicKey && ownerLegacyPublicKey) {
          owner.hcPartyKeys![delegateId] = [encryptedAesKeys[ownerLegacyPublicKey.slice(-32)], encryptedAesKeys[delegate.publicKey.slice(-32)]]
        }
        owner.aesExchangeKeys = {
          ...(ownerCombinedAesExchangeKeys ?? {}),
          [selectedPublicKey]: { ...(owner.aesExchangeKeys?.[selectedPublicKey] ?? {}), [delegateId]: encryptedAesKeys },
        }

        return new Promise<['hcp', HealthcareParty] | ['patient', Patient] | ['device', Device]>((resolve, reject) => {
          ownerType === 'hcp'
            ? (this.dataOwnerCache[owner.id!] = this.hcpartyBaseApi
                .modifyHealthcareParty(owner as HealthcareParty)
                .then((x) => ({ type: 'hcp', dataOwner: x } as CachedDataOwner)))
                .then((x) => resolve(['hcp', x.dataOwner]))
                .catch((e) => reject(e))
            : ownerType === 'patient'
            ? (this.dataOwnerCache[owner.id!] = this.patientBaseApi.modifyPatient(owner as Patient).then((x) => ({ type: 'patient', dataOwner: x })))
                .then((x) => resolve(['patient', x.dataOwner]))
                .catch((e) => reject(e))
            : (this.dataOwnerCache[owner.id!] = this.deviceBaseApi.updateDevice(owner as Device).then((x) => ({ type: 'device', dataOwner: x })))
                .then((x) => resolve(['device', x.dataOwner]))
                .catch((e) => reject(e))
        })
      })

      this.hcPartyKeysRequestsCache[delegateId] = genProm.then(() => {
        return this.forceGetEncryptedAesExchangeKeysForDelegate(delegateId)
      })
      return genProm.then((res) => {
        return res[1]
      })
    })
  }

  getDataOwner(ownerId: string) {
    return (
      this.dataOwnerCache[ownerId] ??
      (this.dataOwnerCache[ownerId] = this.patientBaseApi
        .getPatient(ownerId)
        .then((x) => ({ type: 'patient', dataOwner: x } as CachedDataOwner))
        .catch(() => this.deviceBaseApi.getDevice(ownerId).then((x) => ({ type: 'device', dataOwner: x } as CachedDataOwner)))
        .catch(() => this.hcpartyBaseApi.getHealthcareParty(ownerId).then((x) => ({ type: 'hcp', dataOwner: x } as CachedDataOwner)))
        .catch((e) => {
          delete this.dataOwnerCache[ownerId]
          throw e
        }))
    )
  }

  // noinspection JSUnusedGlobalSymbols
  async checkPrivateKeyValidity(dataOwner: HealthcareParty | Patient | Device): Promise<boolean> {
    const publicKeys = Array.from(new Set([dataOwner.publicKey].concat(Object.keys(dataOwner.aesExchangeKeys ?? {})).filter((x) => !!x))) as string[]

    return await publicKeys.reduce(async (pres, publicKey) => {
      const res = await pres
      if (res) {
        return true
      }
      try {
        const k = await this._RSA.importKey('jwk', spkiToJwk(hex2ua(publicKey)), ['encrypt'])
        const cipher = await this._RSA.encrypt(k, utf8_2ua('shibboleth'))
        const kp = this.loadKeyPairNotImported(dataOwner.id!, publicKey.slice(-32))
        const plainText = await this._RSA
          .importKeyPair('jwk', kp.privateKey, 'jwk', kp.publicKey)
          .then((ikp) => this._RSA.decrypt(ikp.privateKey, new Uint8Array(cipher)))
          .then((x) => ua2utf8(x))
        return plainText === 'shibboleth'
      } catch (e) {
        return false
      }
    }, Promise.resolve(false))
  }

  private throwDetailedExceptionForInvalidParameter(argName: string, argValue: any, methodName: string, methodArgs: any) {
    if (argValue) return

    let details = '\nMethod name: icc-crypto-x-api.' + methodName + '()\nArguments:'

    if (methodArgs) {
      try {
        const argsArray = [...methodArgs]
        _.each(argsArray, (arg, index) => (details += '\n[' + index + ']: ' + JSON.stringify(arg)))
      } catch (ex) {
        details += '; a problem occured while logging arguments details: ' + ex
      }
    }

    throw '### THIS SHOULD NOT HAPPEN: ' + argName + ' has an invalid value: ' + argValue + details
  }

  async getEncryptionDecryptionKeys(dataOwnerId: string, document: EncryptedEntity): Promise<Array<string> | undefined> {
    try {
      return !document.id
        ? undefined
        : _.uniq(
            (
              await this.extractKeysFromDelegationsForHcpHierarchy(
                dataOwnerId,
                document.id,
                (document.encryptionKeys && Object.keys(document.encryptionKeys).length && document.encryptionKeys) || document.delegations!
              )
            ).extractedKeys
          )
    } catch (e) {
      return undefined
    }
  }

  async encryptDecrypt(
    method: 'encrypt' | 'decrypt',
    content: Uint8Array | ArrayBuffer,
    edKey?: string,
    user?: User,
    documentObject?: Document
  ): Promise<Uint8Array | Array<any> | any> {
    if (!content || !(edKey || (user?.healthcarePartyId && documentObject))) return content

    if (edKey) {
      const importedEdKey = await this._AES.importKey('raw', hex2ua(edKey.replace(/-/g, '')))
      try {
        return this._AES[method](importedEdKey, content)
      } catch (e) {
        return content
      }
    }

    const sfks = await this.extractKeysFromDelegationsForHcpHierarchy(user?.healthcarePartyId!, documentObject?.id!, documentObject?.encryptionKeys!)
    const importedEdKey = await this._AES.importKey('raw', hex2ua(sfks.extractedKeys[0].replace(/-/g, '')))
    try {
      return this._AES[method](importedEdKey, content)
    } catch (e) {
      return content
    }
  }
}
