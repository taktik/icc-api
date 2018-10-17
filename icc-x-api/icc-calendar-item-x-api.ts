import * as i18n from "./rsrc/contact.i18n"

import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import { utils } from "./crypto/utils"
import { AES } from "./crypto/AES"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { iccCalendarItemApi } from ".."

export class IccCalendarItemXApi extends iccCalendarItemApi {
  i18n: any = i18n
  crypto: IccCryptoXApi

  constructor(host, headers, crypto) {
    super(host, headers)
    this.crypto = crypto
  }

  newInstance(user, ci) {
    const calendarItem = _.extend(
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
      ci || {}
    )

    return this.crypto
      .initObjectDelegations(calendarItem, null, user.healthcarePartyId, null)
      .then(initData => {
        _.extend(calendarItem, { delegations: initData.delegations })

        let promise = Promise.resolve(calendarItem)
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
              .then(extraData => _.extend(calendarItem, { delegations: extraData.delegations })))
        )
        return promise
      })
  }

  newInstancePatient(
    user: models.UserDto,
    patient: models.PatientDto,
    ci: any
  ): Promise<models.ContactDto> {
    const calendarItem = _.extend(
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
      ci || {}
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, calendarItem)
  }

  private initDelegationsAndEncryptionKeys(
    user: models.UserDto,
    patient: models.PatientDto,
    contact: models.ContactDto
  ): Promise<models.ContactDto> {
    return this.crypto
      .extractDelegationsSFKs(patient, user.healthcarePartyId!)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            contact,
            patient,
            user.healthcarePartyId!,
            secretForeignKeys[0]
          ),
          this.crypto.initEncryptionKeys(contact, user.healthcarePartyId!)
        ])
      )
      .then(initData => {
        const dels = initData[0]
        const eks = initData[1]
        _.extend(contact, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys
        })

        let promise = Promise.resolve(contact)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(contact =>
              this.crypto.addDelegationsAndEncryptionKeys(
                patient,
                contact,
                user.healthcarePartyId!,
                delegateId,
                dels.secretId,
                eks.secretId
              )
            ))
        )
        return promise
      })
  }

  modifyCalendarItemWithHcParty(
    user: models.UserDto,
    body?: models.CalendarItemDto
  ): Promise<models.CalendarItemDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(items => this.modifyCalendarItem(items[0]))
      : Promise.resolve(null)
  }

  createCalendarItemWithHcParty(
    user: models.UserDto,
    body?: models.CalendarItemDto
  ): Promise<models.CalendarItemDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(items => this.createCalendarItem(items[0]))
      : Promise.resolve(null)
  }

  initEncryptionKeys(user: models.UserDto, calendarItem: models.CalendarItemDto) {
    return this.crypto.initEncryptionKeys(calendarItem, user.healthcarePartyId!).then(eks => {
      let promise = Promise.resolve(calendarItem)
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(item =>
            this.crypto
              .appendEncryptionKeys(item, user.healthcarePartyId!, eks.secretId)
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

  encrypt(user: models.UserDto, calendarItems: Array<models.CalendarItemDto>) {
    const hcpartyId = user.healthcarePartyId!
    return Promise.all(
      calendarItems.map(item =>
        (item.encryptionKeys && Object.keys(item.encryptionKeys).length
          ? Promise.resolve(item)
          : this.initEncryptionKeys(user, item)
        )
          .then(ci =>
            this.crypto.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, ci.encryptionKeys!)
          )
          .then(decryptedAndImportedAesHcPartyKeys => {
            let collatedAesKeys: { [key: string]: CryptoKey } = {}
            decryptedAndImportedAesHcPartyKeys.forEach(
              k => (collatedAesKeys[k.delegatorId] = k.key)
            )
            return this.crypto.decryptDelegationsSFKs(
              item.encryptionKeys![hcpartyId],
              collatedAesKeys,
              item.id!
            )
          })
          .then((sfks: Array<string>) =>
            AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, "")))
          )
          .then((key: CryptoKey) => {
            AES.encrypt(key, utils.utf82ua(JSON.stringify({ details: item.details })))
          })
          .then(() => {
            return item
          })
      )
    )
  }
}
