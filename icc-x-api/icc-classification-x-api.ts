import { IccClassificationApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { IccUserXApi } from './icc-user-x-api'

export class IccClassificationXApi extends IccClassificationApi {
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

  newInstance(user: models.User, patient: models.Patient, c: any = {}, delegates: string[] = []): Promise<models.Classification> {
    const classification = _.assign(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Classification',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.userApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
        healthElementId: this.crypto.randomUuid(),
        openingDate: parseInt(moment().format('YYYYMMDDHHmmss')),
      },
      c || {}
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, classification, delegates)
  }

  initDelegationsAndEncryptionKeys(
    user: models.User,
    patient: models.Patient,
    classification: models.Classification,
    delegates: string[] = []
  ): Promise<models.Classification> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto
      .extractDelegationsSFKs(patient, dataOwnerId!)
      .then((secretForeignKeys) => this.crypto.initObjectDelegations(classification, patient, dataOwnerId!, secretForeignKeys.extractedKeys[0]))
      .then((initData) => {
        _.extend(classification, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys,
        })

        let promise = Promise.resolve(classification)
        _.uniq(
          delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : [])
        ).forEach(
          (delegateId) =>
            (promise = promise.then((classification) =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(classification, patient, dataOwnerId!, delegateId, initData.secretId)
                .then((extraData) =>
                  _.extend(classification, {
                    delegations: extraData.delegations,
                    cryptedForeignKeys: extraData.cryptedForeignKeys,
                  })
                )
                .catch((e) => {
                  console.log(e)
                  return classification
                })
            ))
        )

        return promise
      })
  }

  findBy(hcpartyId: string, patient: models.Patient) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then((secretForeignKeys) =>
        this.findClassificationsByHCPartyPatientForeignKeys(secretForeignKeys.hcpartyId!, _.uniq(secretForeignKeys.extractedKeys).join(','))
      )
  }
}
