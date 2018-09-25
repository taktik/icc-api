import { iccMessageApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

export class IccMessageXApi extends iccMessageApi {
  crypto: IccCryptoXApi

  constructor(host: string, headers: Array<XHR.Header>, crypto: IccCryptoXApi) {
    super(host, headers)
    this.crypto = crypto
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.UserDto, p: any) {
    const message = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Message",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      p || {}
    )
    return this.initDelegations(message, null, user)
  }

  initDelegations(
    message: models.MessageDto,
    parentObject: any,
    user: models.UserDto,
    secretForeignKey?: string
  ): Promise<models.MessageDto> {
    return this.crypto
      .initObjectDelegations(
        message,
        parentObject,
        user.healthcarePartyId!,
        secretForeignKey || null
      )
      .then(initData => {
        _.extend(message, { delegations: initData.delegations })

        let promise = Promise.resolve(message)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise
              .then(patient =>
                this.crypto.appendObjectDelegations(
                  message,
                  parentObject,
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
              )
              .then(extraData => _.extend(message, { delegations: extraData.delegations })))
        )
        return promise
      })
  }
}
