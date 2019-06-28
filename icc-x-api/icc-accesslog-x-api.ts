import { iccAccesslogApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as models from "../icc-api/model/models"

import * as _ from "lodash"
import * as moment from "moment"
import { utils } from "./crypto/utils"
import { AES } from "./crypto/AES"

export class IccAccesslogXApi extends iccAccesslogApi {
  crypto: IccCryptoXApi

  constructor(host: string, headers: { [key: string]: string }, crypto: IccCryptoXApi) {
    super(host, headers)
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
        this.crypto.initObjectDelegations(
          accessslog,
          patient,
          hcpId!,
          secretForeignKeys.extractedKeys[0]
        )
      )
      .then(initData => {
        _.extend(accessslog, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys
        })

        let promise = Promise.resolve(accessslog)
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
                  hcpId!,
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

  findBy(hcpartyId: string, patient: models.PatientDto, keepObsoleteVersions: boolean = false) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then(
        secretForeignKeys =>
          secretForeignKeys &&
          secretForeignKeys.extractedKeys &&
          secretForeignKeys.extractedKeys.length > 0
            ? this.findByHCPartyPatientSecretFKeys(
                secretForeignKeys.hcpartyId,
                secretForeignKeys.extractedKeys.join(",")
              )
            : Promise.resolve([])
      )
      .then((decryptedHelements: Array<models.HealthElementDto>) => {
        const byIds: { [key: string]: models.HealthElementDto } = {}

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
          return _.values(byIds).filter((s: any) => !s.endOfLife)
        }
      })
  }

  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys?: string
  ): Promise<Array<models.ContactDto> | any> {
    return super
      .findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys)
      .then(helements => this.decrypt(hcPartyId, helements))
  }

  decrypt(
    hcpartyId: string,
    hes: Array<models.HealthElementDto>
  ): Promise<Array<models.HealthElementDto>> {
    return Promise.all(
      hes.map(he =>
        this.crypto
          .extractKeysFromDelegationsForHcpHierarchy(
            hcpartyId,
            he.id!,
            _.size(he.encryptionKeys) ? he.encryptionKeys! : he.delegations!
          )
          .then(({ extractedKeys: sfks }) => {
            if (!sfks || !sfks.length) {
              console.log("Cannot decrypt helement", he.id)
              return Promise.resolve(he)
            }
            if (he.encryptedSelf) {
              return AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, ""))).then(
                key =>
                  new Promise((resolve: (value: any) => any) =>
                    AES.decrypt(key, utils.text2ua(atob(he.encryptedSelf!))).then(
                      dec => {
                        let jsonContent
                        try {
                          jsonContent = dec && utils.ua2utf8(dec)
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
  serviceToHealthElement(
    user: models.UserDto,
    patient: models.PatientDto,
    heSvc: models.ServiceDto,
    descr: string
  ) {
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
  stringToCode(code: string) {
    const c = code.split("|")
    return new models.CodeDto({
      type: c[0],
      code: c[1],
      version: c[2],
      id: code
    })
  }
}
