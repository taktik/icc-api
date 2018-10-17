import * as i18n from "./rsrc/contact.i18n"

import * as _ from "lodash"
import { iccTimeTableApi } from "../icc-api/api/ICCTimeTableApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

export class IccTimeTableXApi extends iccTimeTableApi {
  i18n: any = i18n
  crypto: IccCryptoXApi

  constructor(host, headers, crypto) {
    super(host, headers)
    this.crypto = crypto
  }

  newInstance(user, tt) {
    const timeTable = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.CalendarItem",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      tt || {}
    )

    return this.crypto
      .initObjectDelegations(timeTable, null, user.healthcarePartyId, null)
      .then(initData => {
        _.extend(timeTable, { delegations: initData.delegations })

        let promise = Promise.resolve(timeTable)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise
              .then(patient =>
                this.crypto.appendObjectDelegations(
                  patient,
                  null,
                  user.healthcarePartyId,
                  delegateId,
                  initData.secretId
                )
              )
              .then(extraData => _.extend(timeTable, { delegations: extraData.delegations })))
        )
        return promise
      })
  }
}
