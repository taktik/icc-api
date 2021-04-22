import { IccClassificationApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'

export class IccClassificationXApi extends IccClassificationApi {
  crypto: IccCryptoXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }

  newInstance(user: models.User, patient: models.Patient, c: any): Promise<models.Classification> {
    const classification = _.assign(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Classification',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId || user.patientId,
        author: user.id,
        codes: [],
        tags: [],
        healthElementId: this.crypto.randomUuid(),
        openingDate: parseInt(moment().format('YYYYMMDDHHmmss')),
      },
      c || {}
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, classification)
  }

  initDelegationsAndEncryptionKeys(
    user: models.User,
    patient: models.Patient,
    classification: models.Classification
  ): Promise<models.Classification> {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId!)
      .then((secretForeignKeys) => this.crypto.initObjectDelegations(classification, patient, hcpId!, secretForeignKeys.extractedKeys[0]))
      .then((initData) => {
        _.extend(classification, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys,
        })

        let promise = Promise.resolve(classification)
        ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
          (delegateId) =>
            (promise = promise.then((classification) =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(classification, patient, hcpId!, delegateId, initData.secretId)
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
        this.findClassificationsByHCPartyPatientForeignKeys(secretForeignKeys.hcpartyId!, secretForeignKeys.extractedKeys.join(','))
      )
  }
}
