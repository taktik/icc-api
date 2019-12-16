"use strict"
var __rest =
  (this && this.__rest) ||
  function(s, e) {
    var t = {}
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p]
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++)
        if (e.indexOf(p[i]) < 0) t[p[i]] = s[p[i]]
    return t
  }
Object.defineProperty(exports, "__esModule", { value: true })
const i18n = require("./rsrc/contact.i18n")
const _ = require("lodash")
const utils_1 = require("./crypto/utils")
const iccApi_1 = require("../icc-api/iccApi")
class IccCalendarItemXApi extends iccApi_1.iccCalendarItemApi {
  constructor(
    host,
    headers,
    crypto,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.i18n = i18n
    this.cryptedKeys = ["detail", "title"]
    this.crypto = crypto
  }
  newInstance(user, ci) {
    const hcpId = user.healthcarePartyId || user.patientId
    const calendarItem = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.CalendarItem",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: hcpId,
        author: user.id,
        codes: [],
        tags: []
      },
      ci || {}
    )
    return this.crypto.initObjectDelegations(calendarItem, null, hcpId, null).then(initData => {
      _.extend(calendarItem, { delegations: initData.delegations })
      let promise = Promise.resolve(calendarItem)
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise
            .then(cal =>
              this.crypto.extendedDelegationsAndCryptedForeignKeys(
                cal,
                null,
                hcpId,
                delegateId,
                initData.secretId
              )
            )
            .then(extraData => _.extend(calendarItem, { delegations: extraData.delegations })))
      )
      return promise
    })
  }
  newInstancePatient(user, patient, ci) {
    const calendarItem = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.CalendarItem",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId || user.patientId,
        author: user.id,
        codes: [],
        tags: []
      },
      ci || {}
    )
    return this.initDelegationsAndEncryptionKeys(user, patient, calendarItem)
  }
  initDelegationsAndEncryptionKeys(user, patient, calendarItem) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            calendarItem,
            patient,
            hcpId,
            secretForeignKeys.extractedKeys[0]
          ),
          this.crypto.initEncryptionKeys(calendarItem, hcpId)
        ])
      )
      .then(initData => {
        const dels = initData[0]
        const eks = initData[1]
        _.extend(calendarItem, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys
        })
        let promise = Promise.resolve(calendarItem)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(contact =>
              this.crypto.addDelegationsAndEncryptionKeys(
                patient,
                contact,
                hcpId,
                delegateId,
                dels.secretId,
                eks.secretId
              )
            ))
        )
        return promise
      })
  }
  findBy(hcpartyId, patient) {
    return this.crypto.extractDelegationsSFKs(patient, hcpartyId).then(secretForeignKeys => {
      return secretForeignKeys &&
        secretForeignKeys.extractedKeys &&
        secretForeignKeys.extractedKeys.length > 0
        ? this.findByHCPartyPatientSecretFKeys(
            secretForeignKeys.hcpartyId,
            secretForeignKeys.extractedKeys.join(",")
          )
        : Promise.resolve([])
    })
  }
  findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys) {
    return super
      .findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys)
      .then(calendarItems => this.decrypt(hcPartyId, calendarItems))
  }
  createCalendarItem(body) {
    throw new Error(
      "Cannot call a method that must encrypt a calendar item without providing a user for de/encryption"
    )
  }
  createCalendarItemWithHcParty(user, body) {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(items => super.createCalendarItem(items[0]))
      : Promise.resolve(null)
  }
  getCalendarItemWithUser(user, calendarItemId) {
    return super
      .getCalendarItem(calendarItemId)
      .then(calendarItem => this.decrypt(user.healthcarePartyId || user.patientId, [calendarItem]))
      .then(cis => cis[0])
  }
  getCalendarItem(calendarItemId) {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }
  getCalendarItemsWithUser(user) {
    return super
      .getCalendarItems()
      .then(calendarItems => this.decrypt(user.healthcarePartyId || user.patientId, calendarItems))
  }
  getCalendarItems() {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }
  getCalendarItemsWithIdsWithUser(user, body) {
    return super
      .getCalendarItemsWithIds(body)
      .then(calendarItems => this.decrypt(user.healthcarePartyId || user.patientId, calendarItems))
  }
  getCalendarItemsWithIds(body) {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }
  getCalendarItemsByPeriodAndHcPartyIdWithUser(user, startDate, endDate, hcPartyId) {
    return super
      .getCalendarItemsByPeriodAndHcPartyId(startDate, endDate, hcPartyId)
      .then(calendarItems => this.decrypt(user.healthcarePartyId || user.patientId, calendarItems))
  }
  getCalendarItemsByPeriodAndHcPartyId(startDate, endDate, hcPartyId) {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }
  getCalendarsByPeriodAndAgendaIdWithUser(user, startDate, endDate, agendaId) {
    return super
      .getCalendarsByPeriodAndAgendaId(startDate, endDate, agendaId)
      .then(calendarItems => this.decrypt(user.healthcarePartyId || user.patientId, calendarItems))
  }
  getCalendarsByPeriodAndAgendaId(startDate, endDate, agendaId) {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }
  modifyCalendarItem(body) {
    throw new Error(
      "Cannot call a method that must encrypt a calendar item without providing a user for de/encryption"
    )
  }
  /**
   * Remove the following delegation objects from the
   * CalendarItem instance: cryptedForeignKeys, secretForeignKeys.
   *
   * The delegations & encryptionKeys objects are not removed because
   * in the case the CalendarItem is saved in the DB & then encrypted,
   * if later we remove the patient from it, it'd reset the delegations
   * and encryptionKeys thus impossibilitating further access.
   *
   * @param calendarItem The Calendar Item object
   */
  resetCalendarDelegationObjects(calendarItem) {
    const { cryptedForeignKeys, secretForeignKeys } = calendarItem,
      resetCalendarItem = __rest(calendarItem, ["cryptedForeignKeys", "secretForeignKeys"])
    return resetCalendarItem
  }
  modifyCalendarItemWithHcParty(user, body) {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(items => super.modifyCalendarItem(items[0]))
      : Promise.resolve(null)
  }
  initEncryptionKeys(user, calendarItem) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(calendarItem, hcpId).then(eks => {
      let promise = Promise.resolve(
        _.extend(calendarItem, {
          encryptionKeys: eks.encryptionKeys
        })
      )
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(item =>
            this.crypto
              .appendEncryptionKeys(item, hcpId, delegateId, eks.secretId)
              .then(extraEks => {
                return _.extend(item, {
                  encryptionKeys: extraEks.encryptionKeys
                })
              })
          ))
      )
      return promise
    })
  }
  encrypt(user, calendarItems) {
    return Promise.all(
      calendarItems.map(calendarItem =>
        (calendarItem.encryptionKeys && Object.keys(calendarItem.encryptionKeys).length
          ? Promise.resolve(calendarItem)
          : this.initEncryptionKeys(user, calendarItem)
        )
          .then(calendarItem =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(
              user.healthcarePartyId || user.patientId,
              calendarItem.id,
              calendarItem.encryptionKeys
            )
          )
          .then(eks =>
            this.crypto.AES.importKey(
              "raw",
              utils_1.utils.hex2ua(eks.extractedKeys[0].replace(/-/g, ""))
            )
          )
          .then(key =>
            utils_1.utils.crypt(
              calendarItem,
              obj => this.crypto.AES.encrypt(key, utils_1.utils.utf82ua(JSON.stringify(obj))),
              this.cryptedKeys
            )
          )
      )
    )
  }
  decrypt(hcpId, calendarItems) {
    //First check that we have no dangling delegation
    return Promise.all(
      calendarItems.map(calendarItem => {
        return calendarItem.encryptedSelf
          ? this.crypto
              .extractKeysFromDelegationsForHcpHierarchy(
                hcpId,
                calendarItem.id,
                _.size(calendarItem.encryptionKeys)
                  ? calendarItem.encryptionKeys
                  : calendarItem.delegations
              )
              .then(({ extractedKeys: sfks }) => {
                if (!sfks || !sfks.length) {
                  return Promise.resolve(calendarItem)
                }
                return this.crypto.AES.importKey(
                  "raw",
                  utils_1.utils.hex2ua(sfks[0].replace(/-/g, ""))
                ).then(key =>
                  utils_1.utils.decrypt(calendarItem, ec =>
                    this.crypto.AES.decrypt(key, ec).then(dec => {
                      const jsonContent = dec && utils_1.utils.ua2utf8(dec)
                      try {
                        return JSON.parse(jsonContent)
                      } catch (e) {
                        console.log(
                          "Cannot parse calendar item",
                          calendarItem.id,
                          jsonContent || "Invalid content"
                        )
                        return {}
                      }
                    })
                  )
                )
              })
          : Promise.resolve(calendarItem)
      })
    )
  }
}
exports.IccCalendarItemXApi = IccCalendarItemXApi
//# sourceMappingURL=icc-calendar-item-x-api.js.map
