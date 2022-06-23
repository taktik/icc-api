import { IccHelementApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { a2b, b2a, hex2ua, string2ua, ua2utf8, utf8_2ua } from './utils/binary-utils'
import { HealthElement } from '../icc-api/model/models'
import { utils } from './crypto/utils'
import { IccUserXApi } from './icc-user-x-api'

export class IccHelementXApi extends IccHelementApi {
  crypto: IccCryptoXApi
  userApi: IccUserXApi

  private readonly encryptedKeys: Array<string>

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    userApi: IccUserXApi,
    encryptedKeys: Array<string> = [],
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.userApi = userApi
    this.encryptedKeys = encryptedKeys
  }

  newInstance(user: models.User, patient: models.Patient, h: any, confidential = false, delegates: string[] = []) {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    const helement = _.assign(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.HealthElement',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: dataOwnerId,
        author: user.id,
        codes: [],
        tags: [],
        healthElementId: this.crypto.randomUuid(),
        openingDate: parseInt(moment().format('YYYYMMDDHHmmss')),
      },
      h || {}
    )

    return this.initDelegationsAndCryptedForeignKeys(helement, patient, user, confidential, delegates)
  }

  initDelegationsAndCryptedForeignKeys(
    healthElement: models.HealthElement,
    patient: models.Patient,
    user: models.User,
    confidential: boolean,
    delegates: string[] = []
  ): Promise<models.HealthElement> {
    let dataOwnerId = this.userApi.getDataOwnerOf(user)

    return this.crypto
      .extractPreferredSfk(patient, dataOwnerId, confidential)
      .then((key) => {
        if (!key) {
          console.error(`SFK cannot be found for HealthElement ${healthElement.id}. The health element will not be reachable from the patient side`)
        }

        return this.crypto.initObjectDelegations(healthElement, patient, dataOwnerId, key)
      })
      .then((initData) => {
        _.extend(healthElement, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys,
        })

        let promise = Promise.resolve(healthElement)
        _.uniq(
          delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : [])
        ).forEach(
          (delegateId) =>
            (promise = promise.then((helement) =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(helement, patient, dataOwnerId, delegateId, initData.secretId)
                .then((extraData) =>
                  _.extend(helement, {
                    delegations: extraData.delegations,
                    cryptedForeignKeys: extraData.cryptedForeignKeys,
                  })
                )
                .catch((e) => {
                  console.log(e)
                  return helement
                })
            ))
        )
        return promise
      })
  }

  createHealthElement(body?: models.HealthElement): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  createHealthElementWithUser(user: models.User, body?: models.HealthElement): Promise<models.HealthElement | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((hes) => super.createHealthElement(hes[0]))
          .then((he) => this.decryptWithUser(user, [he]))
          .then((hes) => hes[0])
      : Promise.resolve(null)
  }

  createHealthElements(body?: Array<HealthElement>): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  createHealthElementsWithUser(user: models.User, bodies?: models.HealthElement[]): Promise<models.HealthElement[] | any> {
    return bodies
      ? this.encrypt(
          user,
          bodies.map((c) => _.cloneDeep(c))
        )
          .then((hes) => super.createHealthElements(hes))
          .then((hes) => this.decrypt(this.userApi.getDataOwnerOf(user), hes))
      : Promise.resolve(null)
  }

  getHealthElement(healthElementId: string): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  getHealthElementWithUser(user: models.User, healthElementId: string): Promise<models.HealthElement> {
    return super
      .getHealthElement(healthElementId)
      .then((he) => this.decryptWithUser(user, [he]))
      .then((hes) => hes[0])
  }

  getHealthElements(body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  getHealthElementsWithUser(user: models.User, body?: models.ListOfIds): Promise<models.HealthElement[]> {
    return super.getHealthElements(body).then((hes) => this.decrypt(this.userApi.getDataOwnerOf(user), hes))
  }

  newHealthElementDelegations(healthElementId: string, body?: Array<models.Delegation>): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  newHealthElementDelegationsWithUser(user: models.User, healthElementId: string, body?: Array<models.Delegation>): Promise<models.HealthElement> {
    return super
      .newHealthElementDelegations(healthElementId, body)
      .then((he) => this.decryptWithUser(user, [he]))
      .then((he) => he[0])
  }

  findHealthElementsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  findHealthElementsByHCPartyPatientForeignKeysWithUser(user: models.User, hcPartyId: string, secretFKeys: string): Promise<HealthElement[]> {
    return super.findHealthElementsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((hes) => this.decryptWithUser(user, hes))
  }

  findHealthElementsByHCPartyAndPatientWithUser(user: models.User, hcPartyId: string, patient: models.Patient): Promise<models.HealthElement[]> {
    return this.crypto.extractSFKsHierarchyFromDelegations(patient, hcPartyId).then((keysAndHcPartyId) => {
      const keys = keysAndHcPartyId.find((secretForeignKeys) => secretForeignKeys.hcpartyId == hcPartyId)?.extractedKeys

      if (keys == undefined) {
        throw Error('No delegation for user')
      }

      return this.findHealthElementsByHCPartyPatientForeignKeysWithUser(user, hcPartyId, keys.join(','))
    })
  }

  modifyHealthElement(body?: HealthElement): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  modifyHealthElementWithUser(user: models.User, body?: HealthElement): Promise<HealthElement | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((hes) => super.modifyHealthElement(hes[0]))
          .then((he) => this.decryptWithUser(user, [he]))
          .then((hes) => hes[0])
      : Promise.resolve(null)
  }

  modifyHealthElements(body?: Array<HealthElement>): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  modifyHealthElementsWithUser(user: models.User, bodies?: HealthElement[]): Promise<HealthElement[] | any> {
    return bodies
      ? this.encrypt(
          user,
          bodies.map((c) => _.cloneDeep(c))
        )
          .then((hes) => super.modifyHealthElements(hes))
          .then((hes) => this.decrypt(this.userApi.getDataOwnerOf(user), hes))
      : Promise.resolve(null)
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

  findBy(hcpartyId: string, patient: models.Patient, keepObsoleteVersions = false) {
    return this.crypto
      .extractSFKsHierarchyFromDelegations(patient, hcpartyId)
      .then((secretForeignKeys) =>
        secretForeignKeys && secretForeignKeys.length > 0
          ? Promise.all(
              secretForeignKeys
                .reduce((acc, level) => {
                  return acc.concat([
                    {
                      hcpartyId: level.hcpartyId,
                      extractedKeys: level.extractedKeys.filter((key) => !acc.some((previousLevel) => previousLevel.extractedKeys.includes(key))),
                    },
                  ])
                }, [] as Array<{ hcpartyId: string; extractedKeys: Array<string> }>)
                .filter((l) => l.extractedKeys.length > 0)
                .map(({ hcpartyId, extractedKeys }) => this.findByHCPartyPatientSecretFKeys(hcpartyId, _.uniq(extractedKeys).join(',')))
            ).then((results) => _.uniqBy(_.flatMap(results), (x) => x.id))
          : Promise.resolve([])
      )
      .then((decryptedHelements: Array<models.HealthElement>) => {
        const byIds: { [key: string]: models.HealthElement } = {}

        if (keepObsoleteVersions) {
          return decryptedHelements
        } else {
          decryptedHelements.forEach((he) => {
            if (he.healthElementId) {
              const phe = byIds[he.healthElementId]
              if (!phe || !phe.modified || (he.modified && phe.modified < he.modified)) {
                byIds[he.healthElementId] = he
              }
            }
          })
          return _.values(byIds).filter((s: any) => !s.endOfLife)
        }
      })
  }

  findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<models.Contact> | any> {
    return super.findHealthElementsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((helements) => this.decrypt(hcPartyId, helements))
  }

  encrypt(user: models.User, healthElements: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    let dataOwnerId = this.userApi.getDataOwnerOf(user)
    return Promise.all(
      healthElements.map((he) =>
        (he.encryptionKeys && Object.keys(he.encryptionKeys).some((k) => !!he.encryptionKeys![k].length)
          ? Promise.resolve(he)
          : this.initEncryptionKeys(user, he)
        )
          .then((healthElement: HealthElement) =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(dataOwnerId, healthElement.id!, healthElement.encryptionKeys!)
          )
          .then((sfks: { extractedKeys: Array<string>; hcpartyId: string }) =>
            this.crypto.AES.importKey('raw', hex2ua(sfks.extractedKeys[0].replace(/-/g, '')))
          )
          .then((key: CryptoKey) =>
            utils.crypt(
              he,
              (obj: { [key: string]: string }) =>
                this.crypto.AES.encrypt(
                  key,
                  utf8_2ua(
                    JSON.stringify(obj, (k, v) => {
                      return v instanceof ArrayBuffer || v instanceof Uint8Array
                        ? b2a(new Uint8Array(v).reduce((d, b) => d + String.fromCharCode(b), ''))
                        : v
                    })
                  )
                ),
              this.encryptedKeys
            )
          )
      )
    )
  }

  initEncryptionKeys(user: models.User, he: models.HealthElement): Promise<models.HealthElement> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto.initEncryptionKeys(he, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(he, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((healthElement) =>
            this.crypto
              .appendEncryptionKeys(healthElement, dataOwnerId!, delegateId, eks.secretId)
              .then((extraEks) => {
                return _.extend(healthElement, {
                  encryptionKeys: extraEks.encryptionKeys,
                })
              })
              .catch((e) => {
                console.log(e.message)
                return healthElement
              })
          ))
      )
      return promise
    })
  }

  decryptWithUser(user: models.User, hes: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return this.decrypt(this.userApi.getDataOwnerOf(user), hes)
  }

  decrypt(dataOwnerId: string, hes: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return Promise.all(
      hes.map((he) =>
        this.crypto
          .extractKeysFromDelegationsForHcpHierarchy(dataOwnerId, he.id!, _.size(he.encryptionKeys) ? he.encryptionKeys! : he.delegations!)
          .then(({ extractedKeys: sfks }) => {
            if (!sfks || !sfks.length) {
              console.log('Cannot decrypt helement', he.id)
              return Promise.resolve(he)
            }
            if (he.encryptedSelf) {
              return this.crypto.AES.importKey('raw', hex2ua(sfks[0].replace(/-/g, ''))).then(
                (key) =>
                  new Promise((resolve: (value: any) => any) =>
                    this.crypto.AES.decrypt(key, string2ua(a2b(he.encryptedSelf!))).then(
                      (dec) => {
                        let jsonContent
                        try {
                          jsonContent = dec && ua2utf8(dec)
                          jsonContent && _.assign(he, JSON.parse(jsonContent))
                        } catch (e) {
                          console.log('Cannot parse he', he.id, jsonContent || '<- Invalid encoding')
                        }
                        resolve(he)
                      },
                      () => {
                        console.log('Cannot decrypt contact', he.id)
                        resolve(he)
                      }
                    )
                  )
              )
            } else {
              return Promise.resolve(he)
            }
          })
      )
    )
  }

  // noinspection JSUnusedGlobalSymbols
  serviceToHealthElement(user: models.User, patient: models.Patient, heSvc: models.Service, descr: string) {
    return this.newInstance(user, patient, {
      idService: heSvc.id,
      author: heSvc.author,
      responsible: heSvc.responsible,
      openingDate: heSvc.valueDate || heSvc.openingDate,
      descr: descr,
      idOpeningContact: heSvc.contactId,
      modified: heSvc.modified,
      created: heSvc.created,
      codes: heSvc.codes,
      tags: heSvc.tags,
    }).then((he) => {
      return this.createHealthElement(he)
    })
  }

  // noinspection JSUnusedGlobalSymbols, JSMethodCanBeStatic
  stringToCode(code: string) {
    const c = code.split('|')
    return new models.Code({
      type: c[0],
      code: c[1],
      version: c[2],
      id: code,
    })
  }
}
