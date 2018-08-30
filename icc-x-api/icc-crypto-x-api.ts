import { iccHcpartyApi } from "../icc-api/iccApi"
import { AES, AESUtils } from "./crypto/AES"
import { RSA, RSAUtils } from "./crypto/RSA"
import { utils, UtilsClass } from "./crypto/utils"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

export class IccCryptoXApi {
  hcPartyKeysCache: {
    [key: string]: { delegatorId: string; key: CryptoKey }
  } = {}
  hcPartyKeysRequestsCache: { [key: string]: Promise<any> } = {}
  keychainLocalStoreIdPrefix: String = "org.taktik.icure.ehealth.keychain."

  hcpartyBaseApi: iccHcpartyApi
  AES: AESUtils = AES
  RSA: RSAUtils = RSA
  utils: UtilsClass = utils

  constructor(host: string, headers: Array<XHR.Header>, hcpartyBaseApi: iccHcpartyApi) {
    this.hcpartyBaseApi = hcpartyBaseApi
  }

  randomUuid() {
    return ((1e7).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      c =>
        (
          Number(c) ^
          (((window || self).crypto.getRandomValues(new Uint8Array(1))! as Uint8Array)[0] &
            (15 >> (Number(c) / 4)))
        ).toString(16) //Keep that inlined or you will loose the random
    )
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
      return (
        Promise.resolve(keyPair) ||
        Promise.resolve(this.RSA.loadKeyPairNotImported(hcPartyKeyOwner)).then(keyPairInJwk =>
          this.cacheKeyPair(keyPairInJwk, hcPartyKeyOwner)
        )
      )
        .then(keyPair =>
          this.RSA.decrypt(keyPair.privateKey, this.utils.hex2ua(encryptedHcPartyKey))
        )
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
      (this.hcPartyKeysRequestsCache[
        delegateHcPartyId
      ] = this.hcpartyBaseApi.getHcPartyKeysForDelegate(delegateHcPartyId))
    ).then((healthcarePartyKeys: { [key: string]: string }) => {
      // For each delegatorId, obtain the AES keys
      return Promise.all(
        delegatorsHcPartyIdsSet.map((delegatorId: string) =>
          this.decryptHcPartyKey(delegatorId, delegateHcPartyId, healthcarePartyKeys[delegatorId])
        )
      )
    })
  }

  decryptAndImportAesHcPartyKeysInDelegations(
    healthcarePartyId: string,
    delegations: { [key: string]: Array<models.DelegationDto> }
  ): Promise<Array<{ delegatorId: string; key: CryptoKey }>> {
    const delegatorIds: { [key: string]: boolean } = {}
    if (delegations[healthcarePartyId]) {
      delegations[healthcarePartyId].forEach(function(delegation) {
        delegatorIds[delegation.owner!] = true
      })
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
    return this.hcpartyBaseApi
      .getHealthcareParty(ownerId)
      .then(owner => owner.hcPartyKeys[ownerId][0])
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

  appendObjectDelegations(
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
    return this.hcpartyBaseApi
      .getHealthcareParty(ownerId)
      .then(owner => {
        if (!owner.hcPartyKeys[delegateId]) {
          return this.generateKeyForDelegate(ownerId, delegateId).then(
            owner => owner.hcPartyKeys[delegateId][0]
          )
        }
        return Promise.resolve(owner.hcPartyKeys[delegateId][0])
      })
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, delegateId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        Promise.all([
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
      .then(encryptedDelegationAndSecretForeignKey => ({
        delegations: _.extend(
          _.cloneDeep(modifiedObject.delegations),
          _.fromPairs([
            [
              delegateId,
              (modifiedObject.delegations[delegateId] || []).concat([
                {
                  owner: ownerId,
                  delegatedTo: delegateId,
                  key: this.utils.ua2hex(encryptedDelegationAndSecretForeignKey[0]!)
                }
              ])
            ]
          ])
        ),
        cryptedForeignKeys: encryptedDelegationAndSecretForeignKey[1]
          ? _.extend(
              _.cloneDeep(modifiedObject.cryptedForeignKeys),
              _.fromPairs([
                [
                  delegateId,
                  (modifiedObject.cryptedForeignKeys[delegateId] || []).concat([
                    {
                      owner: ownerId,
                      delegatedTo: delegateId,
                      key: this.utils.ua2hex(encryptedDelegationAndSecretForeignKey[1]!)
                    }
                  ])
                ]
              ])
            )
          : _.cloneDeep(modifiedObject.cryptedForeignKeys),
        secretId: secretIdOfModifiedObject
      }))
  }

  initEncryptionKeys(
    createdObject: any,
    ownerId: string
  ): Promise<{
    encryptionKeys: any
    secretId: string
  }> {
    const secretId = this.randomUuid()
    return this.hcpartyBaseApi
      .getHealthcareParty(ownerId)
      .then(owner => owner.hcPartyKeys[ownerId][0])
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey, true)
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
    secretIdOfModifiedObject: string
  ): Promise<{
    encryptionKeys: { [key: string]: Array<models.DelegationDto> }
    secretId: string | null
  }> {
    if (!secretIdOfModifiedObject) {
      return Promise.resolve({ encryptionKeys: modifiedObject.encryptionKeys, secretId: null })
    }
    return this.hcpartyBaseApi
      .getHealthcareParty(ownerId)
      .then(owner => owner.hcPartyKeys[ownerId][0])
      .then(encryptedHcPartyKey =>
        this.decryptHcPartyKey(ownerId, ownerId, encryptedHcPartyKey, true)
      )
      .then(importedAESHcPartyKey =>
        this.AES.encrypt(
          importedAESHcPartyKey.key,
          utils.text2ua(modifiedObject.id + ":" + secretIdOfModifiedObject)
        )
      )
      .then(encryptedEncryptionKeys => ({
        encryptionKeys: _.extend(
          _.cloneDeep(modifiedObject.encryptionKeys),
          _.fromPairs([
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
          ])
        ),
        secretId: secretIdOfModifiedObject
      }))
  }

  addDelegationsAndEncryptionKeys(
    parent: models.PatientDto | models.MessageDto | null,
    child:
      | models.PatientDto
      | models.ContactDto
      | models.InvoiceDto
      | models.DocumentDto
      | models.HealthElementDto,
    ownerId: string,
    delegateId: string,
    secretDelegationKey: string,
    secretEncryptionKey: string
  ) {
    return Promise.all([
      this.appendObjectDelegations(child, parent, ownerId, delegateId, secretDelegationKey),
      this.appendEncryptionKeys(child, ownerId, secretEncryptionKey)
    ]).then(extraData => {
      const extraDels = extraData[0]
      const extraEks = extraData[1]
      return _.extend(child, {
        delegations: extraDels.delegations,
        cryptedForeignKeys: extraDels.cryptedForeignKeys,
        encryptionKeys: extraEks.encryptionKeys
      })
    })
  }

  extractDelegationsSFKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto,
    hcpartyId: string
  ): Promise<Array<string>> {
    const dels = document.delegations
    if (!dels || !dels[hcpartyId] || dels[hcpartyId].length <= 0) {
      console.log(
        "There is no delegation for this healthcare party (" +
          hcpartyId +
          ") in document (" +
          document.id +
          ")"
      )
      return Promise.resolve([])
    }
    return this.extractSfks(hcpartyId, document.id!, dels)
  }

  extractEncryptionsSKs(
    document:
      | models.PatientDto
      | models.MessageDto
      | models.ContactDto
      | models.DocumentDto
      | models.InvoiceDto
      | models.HealthElementDto,
    hcpartyId: string
  ): Promise<Array<string>> {
    if (!document.encryptionKeys) {
      return Promise.resolve([])
    }
    const eks = document.encryptionKeys
    if (!eks || !eks[hcpartyId] || eks[hcpartyId].length <= 0) {
      console.log(
        "There is no encryption key for this healthcare party (" +
          hcpartyId +
          ") in document (" +
          document.id +
          ")"
      )
      return Promise.resolve([])
    }
    return this.extractSfks(hcpartyId, document.id!, eks)
  }

  extractSfks(
    hcpartyId: string,
    objectId: string,
    delegations: { [key: string]: Array<models.DelegationDto> }
  ): Promise<Array<string>> {
    return this.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, delegations).then(
      decryptedAndImportedAesHcPartyKeys => {
        var collatedAesKeys: { [key: string]: CryptoKey } = {}
        decryptedAndImportedAesHcPartyKeys.forEach(k => (collatedAesKeys[k.delegatorId] = k.key))
        return this.decryptDelegationsSFKs(delegations[hcpartyId], collatedAesKeys, objectId!)
      }
    )
  }

  decryptDelegationsSFKs(
    delegationsArray: Array<models.DelegationDto>,
    aesKeys: any,
    masterId: string
  ): Promise<Array<string>> {
    const decryptPromises: Array<Promise<string>> = []
    for (var i = 0; i < delegationsArray.length; i++) {
      var delegation = delegationsArray[i]

      decryptPromises.push(
        this.AES.decrypt(aesKeys[delegation.owner!!], this.utils.hex2ua(delegation.key!!)).then(
          (result: ArrayBuffer) => {
            var results = utils.ua2text(result).split(":")
            // results[0]: must be the ID of the object, for checksum
            // results[1]: secretForeignKey
            if (results[0] !== masterId) {
              console.log(
                "Cryptographic mistake: patient ID is not equal to the concatenated id in SecretForeignKey, this may happen when patients have been merged"
              )
            }

            return results[1]
          }
        )
      )
    }

    return Promise.all(decryptPromises)
  }

  loadKeyPairsAsTextInBrowserLocalStorage(healthcarePartyId: string, privateKey: Uint8Array) {
    return this.hcpartyBaseApi
      .getPublicKey(healthcarePartyId)
      .then((publicKey: models.PublicKeyDto) => {
        return this.RSA.importKeyPair(
          "jwk",
          this.utils.pkcs8ToJwk(privateKey),
          "jwk",
          utils.spkiToJwk(utils.hex2ua(publicKey.hexString!))
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

  saveKeychainInBrowserLocalStorage(id: string, keychain: number) {
    localStorage.setItem(
      this.keychainLocalStoreIdPrefix + id,
      btoa(new Uint8Array(keychain).reduce((data, byte) => data + String.fromCharCode(byte), ""))
    )
  }

  loadKeychainFromBrowserLocalStorage(id: String) {
    const lsItem = localStorage.getItem("org.taktik.icure.ehealth.keychain." + id)
    return lsItem && this.utils.base64toByteArray(lsItem)
  }

  generateKeyForDelegate(ownerId: string, delegateId: string) {
    return Promise.all([
      this.hcpartyBaseApi.getHealthcareParty(ownerId),
      this.hcpartyBaseApi.getHealthcareParty(delegateId)
    ]).then(([owner, delegate]) =>
      this.AES.generateCryptoKey(true)
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
            (owner.hcPartyKeys[delegateId] = [
              this.utils.ua2hex(ownerKey),
              this.utils.ua2hex(delegateKey)
            ])
        )
        .then(() => this.hcpartyBaseApi.modifyHealthcareParty(owner))
    )
  }
}
