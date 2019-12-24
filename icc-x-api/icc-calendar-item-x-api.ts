import * as i18n from "./rsrc/contact.i18n"

import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import { utils } from "./crypto/utils"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { iccCalendarItemApi } from "../icc-api/iccApi"
import { XHR } from "../icc-api/api/XHR"
import { CalendarItemDto, UserDto } from "../icc-api/model/models"

export class IccCalendarItemXApi extends iccCalendarItemApi {
  i18n: any = i18n
  crypto: IccCryptoXApi
  cryptedKeys = ["detail", "title"]

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : (self.fetch as any)
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }

  newInstance(user: UserDto, ci: CalendarItemDto) {
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

    return this.crypto.initObjectDelegations(calendarItem, null, hcpId!, null).then(initData => {
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
                hcpId!,
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
  ): Promise<models.CalendarItemDto> {
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

  initDelegationsAndEncryptionKeys(
    user: models.UserDto,
    patient: models.PatientDto,
    calendarItem: models.CalendarItemDto
  ): Promise<models.CalendarItemDto> {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId!)
      .then(secretForeignKeys =>
        Promise.all([
          this.crypto.initObjectDelegations(
            calendarItem,
            patient,
            hcpId!,
            secretForeignKeys.extractedKeys[0]
          ),
          this.crypto.initEncryptionKeys(calendarItem, hcpId!)
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
                hcpId!,
                delegateId,
                dels.secretId,
                eks.secretId
              )
            ))
        )
        return promise
      })
  }

  findBy(hcpartyId: string, patient: models.PatientDto) {
    return this.crypto.extractDelegationsSFKs(patient, hcpartyId).then(secretForeignKeys => {
      return secretForeignKeys &&
        secretForeignKeys.extractedKeys &&
        secretForeignKeys.extractedKeys.length > 0
        ? this.findByHCPartyPatientSecretFKeys(
            secretForeignKeys.hcpartyId!,
            secretForeignKeys.extractedKeys.join(",")
          )
        : Promise.resolve([])
    })
  }

  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys?: string
  ): Promise<Array<models.CalendarItemDto> | any> {
    return super
      .findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys)
      .then(calendarItems => this.decrypt(hcPartyId, calendarItems))
  }

  createCalendarItem(body?: CalendarItemDto): never {
    throw new Error(
      "Cannot call a method that must encrypt a calendar item without providing a user for de/encryption"
    )
  }

  createCalendarItemWithHcParty(
    user: models.UserDto,
    body?: models.CalendarItemDto
  ): Promise<models.CalendarItemDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(items => super.createCalendarItem(items[0]))
      : Promise.resolve(null)
  }

  getCalendarItemWithUser(
    user: models.UserDto,
    calendarItemId: string
  ): Promise<CalendarItemDto | any> {
    return super
      .getCalendarItem(calendarItemId)
      .then(calendarItem =>
        this.decrypt((user.healthcarePartyId || user.patientId)!, [calendarItem])
      )
      .then(cis => cis[0])
  }

  getCalendarItem(calendarItemId: string): never {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }

  getCalendarItemsWithUser(user: models.UserDto): Promise<Array<CalendarItemDto> | any> {
    return super
      .getCalendarItems()
      .then(calendarItems =>
        this.decrypt((user.healthcarePartyId || user.patientId)!, calendarItems)
      )
  }

  getCalendarItems(): never {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }

  getCalendarItemsWithIdsWithUser(
    user: models.UserDto,
    body?: models.ListOfIdsDto
  ): Promise<Array<CalendarItemDto> | any> {
    return super
      .getCalendarItemsWithIds(body)
      .then(calendarItems =>
        this.decrypt((user.healthcarePartyId || user.patientId)!, calendarItems)
      )
  }

  getCalendarItemsWithIds(body?: models.ListOfIdsDto): never {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }

  getCalendarItemsByPeriodAndHcPartyIdWithUser(
    user: models.UserDto,
    startDate?: number,
    endDate?: number,
    hcPartyId?: string
  ): Promise<Array<CalendarItemDto> | any> {
    return super
      .getCalendarItemsByPeriodAndHcPartyId(startDate, endDate, hcPartyId)
      .then(calendarItems =>
        this.decrypt((user.healthcarePartyId || user.patientId)!, calendarItems)
      )
  }

  getCalendarItemsByPeriodAndHcPartyId(
    startDate?: number,
    endDate?: number,
    hcPartyId?: string
  ): never {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }

  getCalendarsByPeriodAndAgendaIdWithUser(
    user: models.UserDto,
    startDate?: number,
    endDate?: number,
    agendaId?: string
  ): Promise<Array<CalendarItemDto> | any> {
    return super
      .getCalendarsByPeriodAndAgendaId(startDate, endDate, agendaId)
      .then(calendarItems =>
        this.decrypt((user.healthcarePartyId || user.patientId)!, calendarItems)
      )
  }

  getCalendarsByPeriodAndAgendaId(startDate?: number, endDate?: number, agendaId?: string): never {
    throw new Error(
      "Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption"
    )
  }

  modifyCalendarItem(body?: CalendarItemDto): never {
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
  resetCalendarDelegationObjects(calendarItem: models.CalendarItemDto): models.CalendarItemDto {
    const { cryptedForeignKeys, secretForeignKeys, ...resetCalendarItem } = calendarItem
    return resetCalendarItem
  }

  modifyCalendarItemWithHcParty(
    user: models.UserDto,
    body?: models.CalendarItemDto
  ): Promise<models.CalendarItemDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(items => super.modifyCalendarItem(items[0]))
      : Promise.resolve(null)
  }

  initEncryptionKeys(user: models.UserDto, calendarItem: models.CalendarItemDto) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(calendarItem, hcpId!).then(eks => {
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
              .appendEncryptionKeys(item, hcpId!, delegateId, eks.secretId)
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

  encrypt(
    user: models.UserDto,
    calendarItems: Array<models.CalendarItemDto>
  ): Promise<Array<models.CalendarItemDto>> {
    return Promise.all(
      calendarItems.map(calendarItem =>
        (calendarItem.encryptionKeys && Object.keys(calendarItem.encryptionKeys).length
          ? Promise.resolve(calendarItem)
          : this.initEncryptionKeys(user, calendarItem)
        )
          .then(calendarItem =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(
              (user.healthcarePartyId || user.patientId)!,
              calendarItem.id!,
              calendarItem.encryptionKeys!
            )
          )
          .then((eks: { extractedKeys: Array<string>; hcpartyId: string }) =>
            this.crypto.AES.importKey("raw", utils.hex2ua(eks.extractedKeys[0].replace(/-/g, "")))
          )
          .then((key: CryptoKey) =>
            utils.crypt(
              calendarItem,
              (obj: { [key: string]: string }) =>
                this.crypto.AES.encrypt(key, utils.utf82ua(JSON.stringify(obj))),
              this.cryptedKeys
            )
          )
      )
    )
  }

  decrypt(
    hcpId: string,
    calendarItems: Array<models.CalendarItemDto>
  ): Promise<Array<models.CalendarItemDto>> {
    //First check that we have no dangling delegation

    return Promise.all(
      calendarItems.map(calendarItem => {
        return calendarItem.encryptedSelf
          ? this.crypto
              .extractKeysFromDelegationsForHcpHierarchy(
                hcpId!,
                calendarItem.id!,
                _.size(calendarItem.encryptionKeys)
                  ? calendarItem.encryptionKeys!
                  : calendarItem.delegations!
              )
              .then(({ extractedKeys: sfks }) => {
                if (!sfks || !sfks.length) {
                  return Promise.resolve(calendarItem)
                }
                return this.crypto.AES.importKey(
                  "raw",
                  utils.hex2ua(sfks[0].replace(/-/g, ""))
                ).then(key =>
                  utils.decrypt(calendarItem, ec =>
                    this.crypto.AES.decrypt(key, ec).then(dec => {
                      const jsonContent = dec && utils.ua2utf8(dec)
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
