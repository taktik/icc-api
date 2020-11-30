import * as i18n from "./rsrc/contact.i18n"

import * as _ from "lodash"
import { IccTimeTableApi } from "../icc-api"
import { User } from "../icc-api/model/User"
import { TimeTable } from "../icc-api/model/TimeTable"
import { IccCryptoXApi } from "./icc-crypto-x-api"

export class IccTimeTableXApi extends IccTimeTableApi {
  i18n: any = i18n
  crypto: IccCryptoXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }

  newInstance(user: User, tt: TimeTable) {
    const timeTable = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.TimeTable",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId || user.patientId,
        author: user.id,
        codes: [],
        tags: []
      },
      tt || {}
    )

    return this.crypto
      .initObjectDelegations(timeTable, null, (user.healthcarePartyId || user.patientId)!, null)
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
                this.crypto.extendedDelegationsAndCryptedForeignKeys(
                  patient,
                  null,
                  (user.healthcarePartyId || user.patientId)!,
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
