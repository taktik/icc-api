"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const models = require("../icc-api/model/models")
const _ = require("lodash")
const moment = require("moment")
const utils_1 = require("./crypto/utils")
class IccHelementXApi extends iccApi_1.iccHelementApi {
  constructor(
    host,
    headers,
    crypto,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }
  newInstance(user, patient, h, confidential = false) {
    const hcpId = user.healthcarePartyId || user.patientId
    const helement = _.assign(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.HealthElement",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: hcpId,
        author: user.id,
        codes: [],
        tags: [],
        healthElementId: this.crypto.randomUuid(),
        openingDate: parseInt(moment().format("YYYYMMDDHHmmss"))
      },
      h || {}
    )
    return this.crypto
      .extractPreferredSfk(patient, hcpId, confidential)
      .then(key => {
        if (!key) {
          console.error(
            `SFK cannot be found for HealthElement ${
              helement.id
            }. The health element will not be reachable from the patient side`
          )
        }
        return this.crypto.initObjectDelegations(helement, patient, hcpId, key)
      })
      .then(initData => {
        _.extend(helement, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys
        })
        let promise = Promise.resolve(helement)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(helement =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(
                  helement,
                  patient,
                  hcpId,
                  delegateId,
                  initData.secretId
                )
                .then(extraData =>
                  _.extend(helement, {
                    delegations: extraData.delegations,
                    cryptedForeignKeys: extraData.cryptedForeignKeys
                  })
                )
                .catch(e => {
                  console.log(e)
                  return helement
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
  findBy(hcpartyId, patient, keepObsoleteVersions = false) {
    return this.crypto
      .extractSFKsHierarchyFromDelegations(patient, hcpartyId)
      .then(
        secretForeignKeys =>
          secretForeignKeys && secretForeignKeys.length > 0
            ? Promise.all(
                secretForeignKeys
                  .reduce((acc, level) => {
                    return acc.concat([
                      {
                        hcpartyId: level.hcpartyId,
                        extractedKeys: level.extractedKeys.filter(
                          key =>
                            !acc.some(previousLevel => previousLevel.extractedKeys.includes(key))
                        )
                      }
                    ])
                  }, [])
                  .filter(l => l.extractedKeys.length > 0)
                  .map(({ hcpartyId, extractedKeys }) =>
                    this.findByHCPartyPatientSecretFKeys(hcpartyId, extractedKeys.join(","))
                  )
              ).then(results => _.uniqBy(_.flatMap(results), x => x.id))
            : Promise.resolve([])
      )
      .then(decryptedHelements => {
        const byIds = {}
        if (keepObsoleteVersions) {
          return decryptedHelements
        } else {
          decryptedHelements.forEach(he => {
            if (he.healthElementId) {
              const phe = byIds[he.healthElementId]
              if (!phe || !phe.modified || (he.modified && phe.modified < he.modified)) {
                byIds[he.healthElementId] = he
              }
            }
          })
          return _.values(byIds).filter(s => !s.endOfLife)
        }
      })
  }
  findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys) {
    return super
      .findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys)
      .then(helements => this.decrypt(hcPartyId, helements))
  }
  decrypt(hcpartyId, hes) {
    return Promise.all(
      hes.map(he =>
        this.crypto
          .extractKeysFromDelegationsForHcpHierarchy(
            hcpartyId,
            he.id,
            _.size(he.encryptionKeys) ? he.encryptionKeys : he.delegations
          )
          .then(({ extractedKeys: sfks }) => {
            if (!sfks || !sfks.length) {
              console.log("Cannot decrypt helement", he.id)
              return Promise.resolve(he)
            }
            if (he.encryptedSelf) {
              return this.crypto.AES.importKey(
                "raw",
                utils_1.utils.hex2ua(sfks[0].replace(/-/g, ""))
              ).then(
                key =>
                  new Promise(resolve =>
                    this.crypto.AES.decrypt(
                      key,
                      utils_1.utils.text2ua(atob(he.encryptedSelf))
                    ).then(
                      dec => {
                        let jsonContent
                        try {
                          jsonContent = dec && utils_1.utils.ua2utf8(dec)
                          jsonContent && _.assign(he, JSON.parse(jsonContent))
                        } catch (e) {
                          console.log(
                            "Cannot parse he",
                            he.id,
                            jsonContent || "<- Invalid encoding"
                          )
                        }
                        resolve(he)
                      },
                      () => {
                        console.log("Cannot decrypt contact", he.id)
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
  serviceToHealthElement(user, patient, heSvc, descr) {
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
      tags: heSvc.tags
    }).then(he => {
      return this.createHealthElement(he)
    })
  }
  // noinspection JSUnusedGlobalSymbols, JSMethodCanBeStatic
  stringToCode(code) {
    const c = code.split("|")
    return new models.CodeDto({
      type: c[0],
      code: c[1],
      version: c[2],
      id: code
    })
  }
}
exports.IccHelementXApi = IccHelementXApi
//# sourceMappingURL=icc-helement-x-api.js.map
