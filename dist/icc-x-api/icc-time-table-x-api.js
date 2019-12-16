"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const i18n = require("./rsrc/contact.i18n")
const _ = require("lodash")
const iccApi_1 = require("../icc-api/iccApi")
class IccTimeTableXApi extends iccApi_1.iccTimeTableApi {
  constructor(
    host,
    headers,
    crypto,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.i18n = i18n
    this.crypto = crypto
  }
  newInstance(user, tt) {
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
      .initObjectDelegations(timeTable, null, user.healthcarePartyId || user.patientId, null)
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
                  user.healthcarePartyId || user.patientId,
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
exports.IccTimeTableXApi = IccTimeTableXApi
//# sourceMappingURL=icc-time-table-x-api.js.map
