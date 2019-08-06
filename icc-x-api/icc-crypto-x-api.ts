import { iccHcpartyApi, iccPatientApi } from "../icc-api/iccApi"
import { AES, AESUtils } from "./crypto/AES"
import { RSA, RSAUtils } from "./crypto/RSA"
import { utils, UtilsClass } from "./crypto/utils"
import { shamir, ShamirClass } from "./crypto/shamir"

import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import { HealthcarePartyDto, DelegationDto, PatientDto } from "../icc-api/model/models"

export class IccCryptoXApi {
  hcPartyKeysCache: {
    [key: string]: { delegatorId: string; key: CryptoKey }
  } = {}
  hcPartiesRequestsCache: {
    [key: string]:
      | { entityType: null; entity: Promise<models.HealthcarePartyDto | models.PatientDto> }
      | { entityType: "hcp"; entity: Promise<models.HealthcarePartyDto> }
      | { entityType: "patient"; entity: Promise<models.PatientDto> }
  } = {}
  hcPartyKeysRequestsCache: { [key: string]: Promise<any> } = {}

  emptyHcpCache(hcpartyId: string) {
    delete this.hcPartiesRequestsCache[hcpartyId]
    delete this.hcPartyKeysRequestsCache[hcpartyId]
  }

  private getHcpOrPatient(
    hcpartyId: string
  ): Promise<models.HealthcarePartyDto | models.PatientDto> {
    const cached = this.hcPartiesRequestsCache[hcpartyId]

    return cached
      ? cached.entity.catch(() => {
          delete this.hcPartiesRequestsCache[hcpartyId]
          return this.getHcpOrPatient(hcpartyId)
        })
      : (this.hcPartiesRequestsCache[hcpartyId] = {
          entityType: null,
          entity: this.hcpartyBaseApi
            .getHealthcareParty(hcpartyId)
            .then(hcp => {
              this.hcPartiesRequestsCache[hcpartyId]!.entityType = "hcp"
              return hcp
            })
            .catch(() =>
              this.patientBaseApi.getPatient(hcpartyId).then(pat => {
                this.hcPartiesRequestsCache[hcpartyId]!.entityType = "patient"
                return pat
              })
            )
        }).entity
  }

  private getCachedHcpOrPatientType(hcpartyId: string): string | null | undefined {
    return (this.hcPartiesRequestsCache[hcpartyId] || {}).entityType
  }

  private getHcPartyKeysForDelegate(delegateHcPartyId: string): Promise<{ [key: string]: string }> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.forceGetHcPartyKeysForDelegate(
        delegateHcPartyId
      ))
    )
  }

  private forceGetHcPartyKeysForDelegate(delegateHcPartyId: string) {
    return Promise.all([
      this.hcpartyBaseApi.getHcPartyKeysForDelegate(delegateHcPartyId).catch(() => {}),
      this.patientBaseApi.getHcPartyKeysForDelegate(delegateHcPartyId).catch(() => {})
    ]).then(([a, b]) => Object.assign({}, a, b))
  }

  keychainLocalStoreIdPrefix: String = "org.taktik.icure.ehealth.keychain."
  hcpPreferenceKeyEhealthCert: string = "eHealthCRT"

  private hcpartyBaseApi: iccHcpartyApi
  private patientBaseApi: iccPatientApi

  AES: AESUtils = AES
  RSA: RSAUtils = RSA
  utils: UtilsClass = utils
  shamir: ShamirClass = shamir

  constructor(
    host: string,
    headers: { [key: string]: string },
    hcpartyBaseApi: iccHcpartyApi,
    patientBaseApi: iccPatientApi
  ) {
    this.hcpartyBaseApi = hcpartyBaseApi
    this.patientBaseApi = patientBaseApi
  }

  randomUuid() {
    return ((1e7).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      c =>
        (
          Number(c) ^
          (((typeof window === "undefined" ? self : window).crypto.getRandomValues(
            new Uint8Array(1)
          )! as Uint8Array)[0] &
            (15 >> (Number(c) / 4)))
        ).toString(16) //Keep that inlined or you will loose the random
    )
  }

  encryptedShamirRSAKey(
    hcp: HealthcarePartyDto,
    notaries: Array<HealthcarePartyDto>,
    threshold: number
  ): Promise<Map<String, String>> {
    const kp = this.RSA.loadKeyPairNotImported(hcp.id!)
    return this.RSA.exportKey(kp.privateKey, "pkcs8").then(exportedKey => {
      const pk = exportedKey as ArrayBuffer
      const { prime, shares } = this.shamir.split(new Uint8Array(pk), notaries.length, threshold)
      const primeCode =
        prime === shamir.prime512.toHex()
          ? "512"
          : prime === shamir.prime3217.toHex()
            ? "3217"
            : "19937"
      return Promise.all(
        notaries.map((notary, idx) => {
          const notaryPubKey = utils.spkiToJwk(utils.hex2ua(notary.publicKey!))
          return this.RSA.importKey("jwk", notaryPubKey, ["encrypt"])
            .then(key => {
              this.RSA.encrypt(
                key,
                this.utils.text2ua(`${primeCode}|${shares[idx].x}|${shares[idx].y}`)
              )
            })
            .then(k => [notary.id, k])
        })
      ).then(keys => _.fromPairs(keys) as Map<string, string>)
    })
  }

  decryptHcPartyKey(
    delegatorId: string,
    delegateHcPartyId: string,
    encryptedHcPartyKey: string,
    encryptedForDelegator: boolean = false
  ): Promise<{ delegatorId: string; key: CryptoKey }> {
    const cacheKey =
      delegatorId + "|" + delegateHcPartyId + "|" + (encryptedForDelegator ? "->" : "<-")
    const res = this.hcPartyKeysCache[cacheKey]
    const hcPartyKeyOwner = encryptedForDelegator ? delegatorId : delegateHcPartyId
    if (res) {
      return Promise.resolve(res)
    } else {
      const keyPair = this.RSA.rsaKeyPairs[hcPartyKeyOwner]
      return (keyPair
        ? Promise.resolve(keyPair)
        : Promise.resolve(this.RSA.loadKeyPairNotImported(hcPartyKeyOwner)).then(keyPairInJwk =>
            this.cacheKeyPair(keyPairInJwk, hcPartyKeyOwner)
          )
      )
        .then(keyPair =>
          this.RSA.decrypt(keyPair.privateKey, this.utils.hex2ua(encryptedHcPartyKey))
        )
        .catch(e => {
          console.log(
            `Cannot decrypt RSA encrypted AES HcPartyKey from ${delegatorId} to ${delegateHcPartyId} as ${
              encryptedForDelegator ? "delegator" : "delegate"
            }`
          )
          throw e
        })
        .then(decryptedHcPartyKey => this.AES.importKey("raw", decryptedHcPartyKey))
        .then(
          decryptedImportedHcPartyKey =>
            (this.hcPartyKeysCache[cacheKey] = {
              delegatorId: delegatorId,
              key: decryptedImportedHcPartyKey
            })
        )
    }
  }

  cacheKeyPair(
    keyPairInJwk: { publicKey: JsonWebKey | ArrayBuffer; privateKey: JsonWebKey | ArrayBuffer },
    hcPartyKeyOwner: string
  ) {
    if (!keyPairInJwk) {
      throw "No RSA private key for Healthcare party(" + hcPartyKeyOwner + ")."
    }
    return this.RSA.importKeyPair(
      "jwk",
      keyPairInJwk.privateKey,
      "jwk",
      keyPairInJwk.publicKey
    ).then(importedKeyPair => {
      return (this.RSA.rsaKeyPairs[hcPartyKeyOwner] = importedKeyPair)
    })
  }

  decryptAndImportAesHcPartyKeysForDelegators(
    delegatorsHcPartyIdsSet: Array<string>,
    delegateHcPartyId: string
  ): Promise<Array<{ delegatorId: string; key: CryptoKey }>> {
    return (
      this.hcPartyKeysRequestsCache[delegateHcPartyId] ||
      (this.hcPartyKeysRequestsCache[delegateHcPartyId] = this.getHcPartyKeysForDelegate(
        delegateHcPartyId
      ))
    ).then((healthcarePartyKeys: { [key: string]: string }) => {
      // For each delegatorId, obtain the AES keys
      return Promise.all(
        delegatorsHcPartyIdsSet.map((delegatorId: string) =>
          this.decryptHcPartyKey(
            delegatorId,
            delegateHcPartyId,
            healthcarePartyKeys[delegatorId]
          ).catch(() => {
            console.log(`failed to decrypt hcPartyKey from ${delegatorId} to ${delegateHcPartyId}`)
            return undefined
          })
        )
      ).then(hcPartyKeys =>
        hcPartyKeys.filter(<T>(hcPartyKey: T | undefined): hcPartyKey is T => !!hcPartyKey)
      )
    })
  }

  decryptAndImportAesHcPartyKeysInDelegations(
    healthcarePartyId: string,
    delegations: { [key: string]: Array<models.DelegationDto> },
    fallbackOnParent = true
  ): Promise<Array<{ delegatorId: string; key: CryptoKey }>> {
    const delegatorIds: { [key: string]: boolean } = {}
    if (delegations[healthcarePartyId] && delegations[healthcarePartyId].length) {
      delegations[healthcarePartyId].forEach(function(delegation) {
        delegatorIds[delegation.owner!] = true
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
    const secretId = this.randomUuid()
    return this.getHcpOrPatient(ownerId)
      .then(owner => owner.hcPartyKeys![ownerId][0])
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
          this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
            createdObject.id + ":" + secretId
          ).buffer as ArrayBuffer),
          parentObject
            ? this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
                createdObject.id + ":" + parentObject.id
              ).buffer as ArrayBuffer)
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
                key: this.utils.ua2hex(encryptedDelegationAndSecretForeignKey[0]!)
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
                    key: this.utils.ua2hex(encryptedDelegationAndSecretForeignKey[1]!)
                  }
                ]
              ]
            ])) ||
          {},
        secretForeignKeys: (secretForeignKeyOfParent && [secretForeignKeyOfParent]) || [],
        secretId: secretId
      }))
  }

  extendedDelegationsAndCryptedForeignKeys(
    modifiedObject: any | null,
    parentObject: any | null,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string | null
  ): Promise<{
    delegations: { [key: string]: Array<models.DelegationDto> }
    cryptedForeignKeys: { [key: string]: Array<models.DelegationDto> }
    secretId: string | null
  }> {
    if (!secretIdOfModifiedObject) {
      return Promise.resolve({
        delegations: modifiedObject.delegations,
        cryptedForeignKeys: modifiedObject.cryptedForeignKeys,
        secretId: null
      })
    }
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
              d.key &&
              this.AES.decrypt(importedAESHcPartyKey.key, this.utils.hex2ua(d.key)).catch(() => {
                console.log(
                  `Cannot decrypt delegation from ${d.owner} to ${
                    d.delegatedTo
                  } for object with id ${modifiedObject.id}:`,
                  modifiedObject
                )
                return null
              })
          ) as Array<Promise<ArrayBuffer>>),

          Promise.all(((modifiedObject.cryptedForeignKeys || {})[delegateId] || []).map(
            (d: DelegationDto) =>
              d.key &&
              this.AES.decrypt(importedAESHcPartyKey.key, this.utils.hex2ua(d.key)).catch(() => {
                console.log(
                  `Cannot decrypt cryptedForeignKeys from ${d.owner} to ${
                    d.delegatedTo
                  } for object with id ${modifiedObject.id}:`,
                  modifiedObject
                )
                return null
              })
          ) as Array<Promise<ArrayBuffer>>),

          this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
            modifiedObject.id + ":" + secretIdOfModifiedObject
          ).buffer as ArrayBuffer),

          parentObject
            ? this.AES.encrypt(importedAESHcPartyKey.key, utils.text2ua(
                modifiedObject.id + ":" + parentObject.id
              ).buffer as ArrayBuffer)
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
            (modifiedObject.delegations[delegateId] || [])
              .concat([
                {
                  owner: ownerId,
                  delegatedTo: delegateId,
                  key: this.utils.ua2hex(cryptedDelegation)
                }
              ])
              .map((d: DelegationDto) => ({ d })),
            (previousDecryptedDelegations || [])
              .map(
                d =>
                  (d && this.utils.ua2text(d)) ||
                  /* some unique id that ensures the delegation is going to be held */ this.randomUuid()
              )
              .concat([`${modifiedObject.id}:${secretIdOfModifiedObject}`])
              .map(k => ({ k }))
          )

          const allDelegations = _.cloneDeep(modifiedObject.delegations)

          //Only keep one version of the decrypted key
          allDelegations[delegateId] = _.uniqBy(delegationCryptedDecrypted, (x: any) => x.k).map(
            (x: any) => x.d
          )

          const cryptedForeignKeysCryptedDecrypted = _.merge(
            ((modifiedObject.cryptedForeignKeys || {})[delegateId] || [])
              .concat(
                cryptedForeignKey
                  ? [
                      {
                        owner: ownerId,
                        delegatedTo: delegateId,
                        key: this.utils.ua2hex(cryptedForeignKey)
                      }
                    ]
                  : []
              )
              .map((d: DelegationDto) => ({ d })),
            (previousDecryptedCryptedForeignKeys || [])
              .map(
                d =>
                  (d && this.utils.ua2text(d)) ||
                  /* some unique id that ensures the delegation is going to be held */ this.randomUuid()
              )
              .concat(cryptedForeignKey ? [`${modifiedObject.id}:${parentObject.id}`] : [])
              .map(k => ({ k }))
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

  initEncryptionKeys(
    createdObject: any,
    ownerId: string
  ): Promise<{
    encryptionKeys: any
    secretId: string
  }> {
    const secretId = this.randomUuid()
    return this.getHcPartyKeysForDelegate(ownerId)
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey[ownerId], true)
      )
      .then(importedAESHcPartyKey =>
        this.AES.encrypt(
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
                key: this.utils.ua2hex(encryptedEncryptionKeys)
              }
            ]
          ]
        ]),
        secretId: secretId
      }))
  }

  appendEncryptionKeys(
    modifiedObject: any,
    ownerId: string,
    delegateId: string,
    secretIdOfModifiedObject: string
  ): Promise<{
    encryptionKeys: { [key: string]: Array<models.DelegationDto> }
    secretId: string | null
  }> {
    if (!secretIdOfModifiedObject) {
      return Promise.resolve({ encryptionKeys: modifiedObject.encryptionKeys, secretId: null })
    }
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
          Promise.all((modifiedObject.encryptionKeys[delegateId] || []).map(
            (eck: DelegationDto) =>
              eck.key && this.AES.decrypt(importedAESHcPartyKey.key, this.utils.hex2ua(eck.key))
          ) as Array<Promise<ArrayBuffer>>),
          this.AES.encrypt(
            importedAESHcPartyKey.key,
            utils.text2ua(modifiedObject.id + ":" + secretIdOfModifiedObject)
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
          (modifiedObject.encryptionKeys[delegateId] || [])
            .concat([
              {
                owner: ownerId,
                delegatedTo: delegateId,
                key: this.utils.ua2hex(encryptedEncryptionKey)
              }
            ])
            .map((d: DelegationDto) => ({ d })),
          (previousDecryptedEncryptionKeys || [])
            .map(d => this.utils.ua2text(d))
            .concat([`${modifiedObject.id}:${secretIdOfModifiedObject}`])
            .map(k => ({ k }))
        )

        const allEncryptionKeys = _.cloneDeep(modifiedObject.encryptionKeys)
        allEncryptionKeys[delegateId] = _.uniqBy(
          encryptionKeysCryptedDecrypted,
          (x: any) => x.k
        ).map((x: any) => x.d)

        return {
          encryptionKeys: allEncryptionKeys,
          secretId: secretIdOfModifiedObject
        }
      })
  }

  //This method is safe. It check if the
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
    secretEncryptionKey: string
  ) {
    return this.extendedDelegationsAndCryptedForeignKeys(
      child,
      parent,
      ownerId,
      delegateId,
      secretDelegationKey
    )
      .then(extraDels =>
        this.appendEncryptionKeys(child, ownerId, delegateId, secretEncryptionKey).then(
          extraEks => ({ extraDels, extraEks })
        )
      )
      .then(({ extraDels, extraEks }) => {
        return _.assign(child, {
          // Conservative version ... We might want to be more aggressive with the deduplication of keys
          // For each delegate, we are going to concatenate to the src (the new delegations), the object in dest (the current delegations)
          // for which we do not find an equivalent delegation (same delegator, same delegate)
          delegations: _.assignWith(child.delegations, extraDels.delegations, (dest, src) =>
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
            extraDels.cryptedForeignKeys,
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
          encryptionKeys: _.assignWith(child.encryptionKeys, extraEks.encryptionKeys, (dest, src) =>
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
      })
  }

  /**
   * Walk up the hierarchy of hcps and extract matching delegations
   * @param document
   * @param hcpartyId
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
      | null,
    hcpartyId?: string
  ): Promise<{ extractedKeys: Array<string>; hcpartyId?: string }> {
    if (!document || !hcpartyId) {
      return Promise.resolve({ extractedKeys: [], hcpartyId: hcpartyId })
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

  // noinspection JSUnusedGlobalSymbols
  extractCryptedFKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto
      | models.ReceiptDto
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
      console.log(`There is no encryption key in document (${document.id})`)
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

  extractKeysFromDelegationsForHcpHierarchy(
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<models.DelegationDto> }
  ): Promise<{ extractedKeys: Array<string>; hcpartyId: string }> {
    return this.getHcpOrPatient(hcpartyId).then(hcp =>
      (delegations[hcpartyId] && delegations[hcpartyId].length
        ? this.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, delegations, false).then(
            decryptedAndImportedAesHcPartyKeys => {
              const collatedAesKeysFromDelegatorToHcpartyId: { [key: string]: CryptoKey } = {}
              decryptedAndImportedAesHcPartyKeys.forEach(
                k => (collatedAesKeysFromDelegatorToHcpartyId[k.delegatorId] = k.key)
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

  decryptKeyInDelegationLikes(
    delegationsArray: Array<models.DelegationDto>,
    aesKeys: { [key: string]: CryptoKey },
    masterId: string
  ): Promise<Array<string>> {
    const decryptPromises: Array<Promise<string | undefined>> = []
    for (var i = 0; i < (delegationsArray || []).length; i++) {
      var delegation = delegationsArray[i]

      decryptPromises.push(
        this.AES.decrypt(aesKeys[delegation.owner!!], this.utils.hex2ua(delegation.key!!))
          .then((result: ArrayBuffer) => {
            var results = utils.ua2text(result).split(":")
            // results[0]: must be the ID of the object, for checksum
            // results[1]: secretForeignKey
            if (results[0] !== masterId) {
              console.log(
                "Cryptographic mistake: patient ID is not equal to the concatenated id in SecretForeignKey, this may happen when patients have been merged"
              )
            }

            return results[1]
          })
          .catch(err => {
            console.log(
              `Could not decrypt delegation in ${masterId} from ${delegation.owner} to ${
                delegation.delegatedTo
              }: ${err}`
            )
            return undefined
          })
      )
    }

    return Promise.all(decryptPromises).then(sfks => sfks.filter(sfk => !!sfk) as string[])
  }

  loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    return this.getHcpOrPatient(healthcarePartyId)
      .then(hcpOrPat => hcpOrPat.publicKey)
      .then((publicKey?: string) => {
        if (!publicKey) {
          throw new Error("No public key has been defined for hcp")
        }
        return this.RSA.importKeyPair(
          "jwk",
          this.utils.pkcs8ToJwk(privateKey),
          "jwk",
          utils.spkiToJwk(utils.hex2ua(publicKey))
        )
      })
      .then((keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) => {
        this.RSA.rsaKeyPairs[healthcarePartyId] = keyPair
        return this.RSA.exportKeys(keyPair, "jwk", "jwk")
      })
      .then(exportedKeyPair => {
        return this.RSA.storeKeyPair(healthcarePartyId, exportedKeyPair)
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

        return this.RSA.importKeyPair("jwk", privKey, "jwk", pubKey)
      })
      .then((keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }) => {
        this.RSA.rsaKeyPairs[healthcarePartyId] = keyPair
        return this.RSA.exportKeys(keyPair, "jwk", "jwk")
      })
      .then((exportedKeyPair: { publicKey: any; privateKey: any }) => {
        return this.RSA.storeKeyPair(healthcarePartyId, exportedKeyPair)
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
    return lsItem !== null ? this.utils.base64toByteArray(lsItem) : null
  }

  generateKeyForDelegate(
    ownerId: string,
    delegateId: string
  ): Promise<models.HealthcarePartyDto | models.PatientDto> {
    //Preload hcp and patient because we need them and they are going to be invalidated from the caches
    return Promise.all([this.getHcpOrPatient(ownerId), this.getHcpOrPatient(delegateId)]).then(
      ([owner, delegate]) => {
        const ownerType = this.getCachedHcpOrPatientType(owner.id!!)

        const genProm = new Promise<
          [null | "hcp" | "patient", models.HealthcarePartyDto | models.PatientDto]
        >((resolve, reject) => {
          delegate.publicKey
            ? this.AES.generateCryptoKey(true)
                .then(AESKey => {
                  const ownerPubKey = utils.spkiToJwk(utils.hex2ua(owner.publicKey!))
                  const delegatePubKey = utils.spkiToJwk(utils.hex2ua(delegate.publicKey!))

                  return Promise.all([
                    this.RSA.importKey("jwk", ownerPubKey, ["encrypt"]),
                    this.RSA.importKey("jwk", delegatePubKey, ["encrypt"])
                  ]).then(([ownerImportedKey, delegateImportedKey]) =>
                    Promise.all([
                      this.RSA.encrypt(ownerImportedKey, this.utils.hex2ua(AESKey as string)),
                      this.RSA.encrypt(delegateImportedKey, this.utils.hex2ua(AESKey as string))
                    ])
                  )
                })
                .then(
                  ([ownerKey, delegateKey]) =>
                    (owner.hcPartyKeys![delegateId] = [
                      this.utils.ua2hex(ownerKey),
                      this.utils.ua2hex(delegateKey)
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

        //Those caches are invalidated first so that subsequents call to hcPartiesRequestsCache or hcPartyKeysRequestsCache take into account the newly generated keys
        //And we do not have parallel processes for keys generations
        // invalidate the hcp cache for the modified hcp
        this.hcPartiesRequestsCache[ownerId] = {
          entityType: null,
          entity: genProm.then(hcpOrPat => {
            this.hcPartiesRequestsCache[ownerId].entityType = hcpOrPat[0]
            return hcpOrPat[1]
          })
        }
        // invalidate the hcPartyKeys cache for the delegate hcp (who was not modified, but the view for its
        // id was updated)
        this.hcPartyKeysRequestsCache[delegateId] = genProm.then(() =>
          this.forceGetHcPartyKeysForDelegate(delegateId)
        )
        return genProm.then(res => res[1])
      }
    )
  }

  // noinspection JSUnusedGlobalSymbols
  checkPrivateKeyValidity(hcp: models.HealthcarePartyDto | models.PatientDto): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.RSA.importKey("jwk", utils.spkiToJwk(utils.hex2ua(hcp.publicKey!)), ["encrypt"])
        .then(k => this.RSA.encrypt(k, this.utils.utf82ua("shibboleth")))
        .then(cipher => {
          const kp = this.RSA.loadKeyPairNotImported(hcp.id!)
          return this.RSA.importKeyPair("jwk", kp.privateKey, "jwk", kp.publicKey).then(ikp =>
            this.RSA.decrypt(ikp.privateKey, new Uint8Array(cipher))
          )
        })
        .then(plainText => {
          const pt = this.utils.ua2utf8(plainText)
          console.log(pt)
          resolve(pt === "shibboleth")
        })
        .catch(() => resolve(false))
    })
  }
}
