"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const _ = require("lodash")
const utils_1 = require("./crypto/utils")
// noinspection JSUnusedGlobalSymbols
class IccFormXApi extends iccApi_1.iccFormApi {
  constructor(
    host,
    headers,
    crypto,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }
  // noinspection JSUnusedGlobalSymbols
  newInstance(user, patient, c) {
    const form = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Form",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId || user.patientId,
        author: user.id,
        codes: [],
        tags: []
      },
      c || {}
    )
    return this.initDelegationsAndEncryptionKeys(user, patient, form)
  }
  initDelegationsAndEncryptionKeys(user, patient, form) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            form,
            patient,
            hcpId,
            secretForeignKeys.extractedKeys[0]
          ),
          this.crypto.initEncryptionKeys(form, hcpId)
        ])
      )
      .then(initData => {
        const dels = initData[0]
        const eks = initData[1]
        _.extend(form, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys
        })
        let promise = Promise.resolve(form)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(form =>
              this.crypto
                .addDelegationsAndEncryptionKeys(
                  patient,
                  form,
                  hcpId,
                  delegateId,
                  dels.secretId,
                  eks.secretId
                )
                .catch(e => {
                  console.log(e)
                  return form
                })
            ))
        )
        return promise
      })
  }
  initEncryptionKeys(user, form) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(form, hcpId).then(eks => {
      let promise = Promise.resolve(
        _.extend(form, {
          encryptionKeys: eks.encryptionKeys
        })
      )
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(contact =>
            this.crypto
              .appendEncryptionKeys(contact, hcpId, delegateId, eks.secretId)
              .then(extraEks => {
                return _.extend(contact, {
                  encryptionKeys: extraEks.encryptionKeys
                })
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
   * 6. Do the REST call to get all contacts with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the contacts of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   */
  findBy(hcpartyId, patient) {
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
  decrypt(hcpartyId, forms) {
    return Promise.all(
      forms.map(form =>
        this.crypto
          .extractKeysFromDelegationsForHcpHierarchy(
            hcpartyId,
            form.id,
            _.size(form.encryptionKeys) ? form.encryptionKeys : form.delegations
          )
          .then(({ extractedKeys: sfks }) => {
            if (form.encryptedSelf) {
              return this.crypto.AES.importKey(
                "raw",
                utils_1.utils.hex2ua(sfks[0].replace(/-/g, ""))
              )
                .then(
                  key =>
                    new Promise(resolve => {
                      this.crypto.AES.decrypt(
                        key,
                        utils_1.utils.text2ua(atob(form.encryptedSelf))
                      ).then(resolve, () => {
                        console.log("Cannot decrypt form", form.id)
                        resolve(null)
                      })
                    })
                )
                .then(decrypted => {
                  if (decrypted) {
                    form = _.extend(form, JSON.parse(utils_1.utils.ua2text(decrypted)))
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
      )
    ).catch(function(e) {
      console.log(e)
    })
  }
}
exports.IccFormXApi = IccFormXApi
//# sourceMappingURL=icc-form-x-api.js.map
