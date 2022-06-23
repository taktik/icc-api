import { IccFormApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'

import { a2b, hex2ua, string2ua, ua2string } from './utils/binary-utils'
import { IccUserXApi } from './icc-user-x-api'

// noinspection JSUnusedGlobalSymbols
export class IccFormXApi extends IccFormApi {
  crypto: IccCryptoXApi
  userApi: IccUserXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    userApi: IccUserXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.userApi = userApi
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.User, patient: models.Patient, c: any = {}, delegates: string[] = []) {
    const form = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Form',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.userApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      c || {}
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, form, delegates)
  }

  initEncryptionKeys(user: models.User, form: models.Form) {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto.initEncryptionKeys(form, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(form, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((contact) =>
            this.crypto.appendEncryptionKeys(contact, dataOwnerId!, delegateId, eks.secretId).then((extraEks) => {
              return _.extend(contact, {
                encryptionKeys: extraEks.encryptionKeys,
              })
            })
          ))
      )
      return promise
    })
  }

  private initDelegationsAndEncryptionKeys(
    user: models.User,
    patient: models.Patient,
    form: models.Form,
    delegates: string[] = []
  ): Promise<models.Form> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto
      .extractDelegationsSFKs(patient, dataOwnerId!)
      .then((secretForeignKeys) =>
        Promise.all([
          this.crypto.initObjectDelegations(form, patient, dataOwnerId!, secretForeignKeys.extractedKeys[0]),
          this.crypto.initEncryptionKeys(form, dataOwnerId!),
        ])
      )
      .then((initData) => {
        const dels = initData[0]
        const eks = initData[1]
        _.extend(form, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys,
        })

        let promise = Promise.resolve(form)
        _.uniq(
          delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : [])
        ).forEach(
          (delegateId) =>
            (promise = promise.then((form) =>
              this.crypto.addDelegationsAndEncryptionKeys(patient, form, dataOwnerId!, delegateId, dels.secretId, eks.secretId).catch((e) => {
                console.log(e)
                return form
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
  findBy(hcpartyId: string, patient: models.Patient) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then((secretForeignKeys) =>
        this.findFormsByHCPartyPatientForeignKeys(secretForeignKeys.hcpartyId!, _.uniq(secretForeignKeys.extractedKeys).join(','))
      )
      .then((forms) => this.decrypt(hcpartyId, forms))
      .then(function (decryptedForms) {
        return decryptedForms
      })
  }

  decrypt(hcpartyId: string, forms: Array<models.Form>) {
    return Promise.all(
      forms.map((form) =>
        this.crypto
          .extractKeysFromDelegationsForHcpHierarchy(hcpartyId, form.id!, _.size(form.encryptionKeys) ? form.encryptionKeys! : form.delegations!)
          .then(({ extractedKeys: sfks }) => {
            if (form.encryptedSelf) {
              return this.crypto.AES.importKey('raw', hex2ua(sfks[0].replace(/-/g, '')))
                .then(
                  (key) =>
                    new Promise((resolve: (value: any) => any) => {
                      this.crypto.AES.decrypt(key, string2ua(a2b(form.encryptedSelf!))).then(resolve, () => {
                        console.log('Cannot decrypt form', form.id)
                        resolve(null)
                      })
                    })
                )
                .then((decrypted: ArrayBuffer) => {
                  if (decrypted) {
                    form = _.extend(form, JSON.parse(ua2string(decrypted)))
                  }
                  return form
                })
            } else {
              return Promise.resolve(form)
            }
          })
          .catch(function (e) {
            console.log(e)
          })
      )
    ).catch(function (e) {
      console.log(e)
    })
  }
}
