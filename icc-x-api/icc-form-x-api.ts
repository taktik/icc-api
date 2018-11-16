import { iccFormApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

import { utils } from "./crypto/utils"
import { AES } from "./crypto/AES"

// noinspection JSUnusedGlobalSymbols
export class IccFormXApi extends iccFormApi {
  crypto: IccCryptoXApi

  constructor(host: string, headers: Array<XHR.Header>, crypto: IccCryptoXApi) {
    super(host, headers)
    this.crypto = crypto
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.UserDto, patient: models.PatientDto, c: any) {
    const form = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Form",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      c || {}
    )

    return this.crypto
      .extractDelegationsSFKs(patient, user.healthcarePartyId!)
      .then(secretForeignKeys =>
        this.crypto.initObjectDelegations(
          form,
          patient,
          user.healthcarePartyId!,
          secretForeignKeys.extractedKeys[0]
        )
      )
      .then(initData => {
        _.extend(form, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys
        })

        let promise = Promise.resolve(form)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise
              .then(form =>
                this.crypto.appendObjectDelegations(
                  form,
                  patient,
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
              )
              .then(extraData =>
                _.extend(form, {
                  delegations: extraData.delegations,
                  cryptedForeignKeys: extraData.cryptedForeignKeys
                })
              )
              .catch(e => {
                console.log(e)
                return form
              }))
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
   * 6. Do the REST call to get all contacts with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the contacts of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   */
  findBy(hcpartyId: string, patient: models.PatientDto) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then(secretForeignKeys =>
        this.findByHCPartyPatientSecretFKeys(
          secretForeignKeys.hcpartyId,
          secretForeignKeys.extractedKeys.join(",")
        )
      )
      .then(forms => this.decrypt(hcpartyId, forms))
      .then(function(decryptedForms) {
        return decryptedForms
      })
  }

  decrypt(hcpartyId: string, forms: Array<models.FormDto>) {
    return Promise.all(
      forms.map(form =>
        this.crypto
          .decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, form.delegations!)
          .then(
            (
              decryptedAndImportedAesHcPartyKeys: Array<{
                delegatorId: string
                key: CryptoKey
              }>
            ) => {
              var collatedAesKeys: { [key: string]: CryptoKey } = {}
              decryptedAndImportedAesHcPartyKeys.forEach(
                k => (collatedAesKeys[k.delegatorId] = k.key)
              )
              return this.crypto
                .decryptDelegationsSFKs(form.delegations![hcpartyId], collatedAesKeys, form.id!)
                .then((sfks: Array<string>) => {
                  if (form.encryptedSelf) {
                    return AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, "")))
                      .then(
                        key =>
                          new Promise((resolve: (value: any) => any) => {
                            AES.decrypt(key, utils.text2ua(atob(form.encryptedSelf!))).then(
                              resolve,
                              () => {
                                console.log("Cannot decrypt form", form.id)
                                resolve(null)
                              }
                            )
                          })
                      )
                      .then((decrypted: ArrayBuffer) => {
                        if (decrypted) {
                          form = _.extend(form, JSON.parse(utils.ua2text(decrypted)))
                        }
                        return form
                      })
                  } else {
                    return Promise.resolve(form)
                  }
                })
                .catch(function(e) {
                  console.log(e)
                })
            }
          )
      )
    ).catch(function(e) {
      console.log(e)
    })
  }
}
