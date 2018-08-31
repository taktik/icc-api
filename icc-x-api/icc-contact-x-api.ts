import { iccContactApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "../icc-x-api/icc-crypto-x-api"

import i18n from "./rsrc/contact.i18n"
import { utils } from "./crypto/utils"
import { AES } from "./crypto/AES"
import { RSA } from "./crypto/RSA"

import moment from "moment"
import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import { XHR } from "../icc-api/api/XHR"
import { ContactDto } from "../icc-api/model/models"

export class IccContactXApi extends iccContactApi {
  i18n: any = i18n
  crypto: IccCryptoXApi

  constructor(host: string, headers: Array<XHR.Header>, crypto: IccCryptoXApi) {
    super(host, headers)
    this.crypto = crypto
  }

  newInstance(
    user: models.UserDto,
    patient: models.PatientDto,
    c: any
  ): Promise<models.ContactDto> {
    const contact = new models.ContactDto(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          _type: "org.taktik.icure.entities.Contact",
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: user.healthcarePartyId,
          author: user.id,
          codes: [],
          tags: [],
          groupId: this.crypto.randomUuid(),
          subContacts: [],
          services: [],
          openingDate: parseInt(moment().format("YYYYMMDDHHmmss"))
        },
        c || {}
      )
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, contact)
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

  initEncryptionKeys(user: models.UserDto, ctc: models.ContactDto) {
    return this.crypto.initEncryptionKeys(ctc, user.healthcarePartyId!).then(eks => {
      let promise = Promise.resolve(
        _.extend(ctc, {
          encryptionKeys: eks.encryptionKeys
        })
      )
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(contact =>
            this.crypto
              .appendEncryptionKeys(contact, user.healthcarePartyId!, eks.secretId)
              .then(extraEks => {
                return _.extend(contact, {
                  encryptionKeys: extraEks.encryptionKeys
                })
              })
          ))
      )
      return promise
    })
  }

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
  findBy(hcpartyId: string, patient: models.PatientDto) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then(secretForeignKeys =>
        this.findByHCPartyPatientSecretFKeys(hcpartyId, secretForeignKeys.join(","))
      )
      .then(contacts => this.decrypt(hcpartyId, contacts))
      .then(function(decryptedContacts) {
        return decryptedContacts
      })
  }

  filterBy(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChain
  ): Promise<models.ContactPaginatedList | any> {
    throw "Cannot call a method that returns contacts without providing a user for decryption"
  }

  findByHCPartyFormId(
    hcPartyId?: string,
    formId?: string
  ): Promise<Array<models.ContactDto> | any> {
    throw "Cannot call a method that returns contacts without providing a user for decryption"
  }

  findByHCPartyFormIds(
    hcPartyId?: string,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.ContactDto> | any> {
    throw "Cannot call a method that returns contacts without providing a user for decryption"
  }

  getContact(contactId: string): Promise<models.ContactDto | any> {
    throw "Cannot call a method that returns contacts without providing a user for decryption"
  }

  getContacts(body?: models.ListOfIdsDto): Promise<Array<models.ContactDto> | any> {
    throw "Cannot call a method that returns contacts without providing a user for decryption"
  }

  filterByWithUser(
    user: models.UserDto,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChain
  ): Promise<models.ContactPaginatedList | any> {
    return super
      .filterBy(startKey, startDocumentId, limit, body)
      .then(ctcs => this.encrypt(user, ctcs))
  }

  findByHCPartyFormIdWithUser(
    user: models.UserDto,
    hcPartyId?: string,
    formId?: string
  ): Promise<Array<models.ContactDto> | any> {
    return super.findByHCPartyFormId(hcPartyId, formId).then(ctcs => this.encrypt(user, ctcs))
  }

  findByHCPartyFormIdsWithUser(
    user: models.UserDto,
    hcPartyId?: string,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.ContactDto> | any> {
    return super.findByHCPartyFormIds(hcPartyId, body).then(ctcs => this.encrypt(user, ctcs))
  }

  getContactWithUser(user: models.UserDto, contactId: string): Promise<models.ContactDto | any> {
    return super
      .getContact(contactId)
      .then(ctc => this.decrypt(user.healthcarePartyId!, [ctc]))
      .then(ctcs => ctcs[0])
  }

  getContactsWithUser(
    user: models.UserDto,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.ContactDto> | any> {
    return super.getContacts(body).then(ctcs => this.decrypt(user.healthcarePartyId!, ctcs))
  }

  modifyContactWithUser(
    user: models.UserDto,
    body?: models.ContactDto
  ): Promise<models.ContactDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(ctcs => this.modifyContact(ctcs[0]))
      : Promise.resolve(null)
  }

  createContactWithUser(
    user: models.UserDto,
    body?: models.ContactDto
  ): Promise<models.ContactDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)]).then(ctcs => this.createContact(ctcs[0]))
      : Promise.resolve(null)
  }

  encrypt(user: models.UserDto, ctcs: Array<models.ContactDto>) {
    const hcpartyId = user.healthcarePartyId!
    return Promise.all(
      ctcs.map(ctc =>
        (ctc.encryptionKeys && Object.keys(ctc.encryptionKeys).length
          ? Promise.resolve(ctc)
          : this.initEncryptionKeys(user, ctc)
        )
          .then(ctc =>
            this.crypto.decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, ctc.encryptionKeys!)
          )
          .then(decryptedAndImportedAesHcPartyKeys => {
            var collatedAesKeys: { [key: string]: CryptoKey } = {}
            decryptedAndImportedAesHcPartyKeys.forEach(
              k => (collatedAesKeys[k.delegatorId] = k.key)
            )
            return this.crypto.decryptDelegationsSFKs(
              ctc.encryptionKeys![hcpartyId],
              collatedAesKeys,
              ctc.id!
            )
          })
          .then((sfks: Array<string>) =>
            AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, "")))
          )
          .then((key: CryptoKey) =>
            Promise.all(
              ctc.services!.map(svc =>
                AES.encrypt(key, utils.utf82ua(JSON.stringify({ content: svc.content })))
              )
            )
              .then(eSvcs => {
                console.log("eSvcs ", eSvcs)
                ctc.services!.forEach((svc, idx) => {
                  svc.encryptedSelf = btoa(utils.ua2text(eSvcs[idx]))
                  delete svc.content
                })
              })
              .then(() => AES.encrypt(key, utils.utf82ua(JSON.stringify({ descr: ctc.descr }))))
              .then(es => {
                ctc.encryptedSelf = btoa(utils.ua2text(es))
                delete ctc.descr
                return ctc
              })
          )
      )
    )
  }

  decrypt(hcpartyId: string, ctcs: Array<models.ContactDto>): Promise<Array<models.ContactDto>> {
    return Promise.all(
      ctcs.map(ctc =>
        this.crypto
          .decryptAndImportAesHcPartyKeysInDelegations(
            hcpartyId,
            ctc.encryptionKeys && Object.keys(ctc.encryptionKeys).length
              ? ctc.encryptionKeys
              : ctc.delegations!
          )
          .then(decryptedAndImportedAesHcPartyKeys => {
            var collatedAesKeys: { [key: string]: CryptoKey } = {}
            decryptedAndImportedAesHcPartyKeys.forEach(
              k => (collatedAesKeys[k.delegatorId] = k.key)
            )
            return this.crypto
              .decryptDelegationsSFKs(
                (ctc.encryptionKeys && Object.keys(ctc.encryptionKeys).length
                  ? ctc.encryptionKeys
                  : ctc.delegations)![hcpartyId],
                collatedAesKeys,
                ctc.id!
              )
              .then((sfks: Array<string>) => {
                return Promise.all(
                  ctc.services!.map(svc => {
                    if (svc.encryptedContent || svc.encryptedSelf) {
                      return AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, "")))
                        .then(
                          (key: CryptoKey) =>
                            new Promise((resolve: (value: any) => any) => {
                              svc.encryptedContent
                                ? AES.decrypt(key, utils.text2ua(atob(svc.encryptedContent!))).then(
                                    c => {
                                      let jsonContent
                                      try {
                                        jsonContent = utils.ua2utf8(c!).replace(/\0+$/g, "")
                                        resolve(c && { content: JSON.parse(jsonContent) })
                                      } catch (e) {
                                        console.log(
                                          "Cannot parse service",
                                          svc.id,
                                          jsonContent || "<- Invalid encoding"
                                        )
                                        resolve(null)
                                      }
                                    },
                                    () => {
                                      console.log("Cannot decrypt service", svc.id)
                                      resolve(null)
                                    }
                                  )
                                : svc.encryptedSelf
                                  ? AES.decrypt(key, utils.text2ua(atob(svc.encryptedSelf!))).then(
                                      s => {
                                        let jsonContent
                                        try {
                                          jsonContent = utils.ua2utf8(s!).replace(/\0+$/g, "")
                                          resolve(s && JSON.parse(jsonContent))
                                        } catch (e) {
                                          console.log(
                                            "Cannot parse service",
                                            svc.id,
                                            jsonContent || "<- Invalid encoding"
                                          )
                                          resolve(null)
                                        }
                                      },
                                      () => {
                                        console.log("Cannot decrypt service", svc.id)
                                        resolve(null)
                                      }
                                    )
                                  : resolve(null)
                            })
                        )
                        .then(decrypted => {
                          decrypted && _.assign(svc, decrypted)
                          return svc
                        })
                    } else {
                      return svc
                    }
                  })
                ).then((svcs: Array<models.ServiceDto>) => {
                  ctc.services = svcs
                  //console.log('ES:'+ctc.encryptedSelf)
                  return ctc.encryptedSelf
                    ? AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, ""))).then(
                        key =>
                          new Promise<models.ContactDto>(
                            (resolve: (value: models.ContactDto) => any) => {
                              AES.decrypt(key, utils.text2ua(atob(ctc.encryptedSelf!))).then(
                                dec => {
                                  let jsonContent
                                  try {
                                    jsonContent = dec && utils.ua2utf8(dec)
                                    jsonContent && _.assign(ctc, JSON.parse(jsonContent))
                                  } catch (e) {
                                    console.log(
                                      "Cannot parse ctc",
                                      ctc.id,
                                      jsonContent || "<- Invalid encoding"
                                    )
                                  }
                                  resolve(ctc)
                                },
                                () => {
                                  console.log("Cannot decrypt contact", ctc.id)
                                  resolve(ctc)
                                }
                              )
                            }
                          )
                      )
                    : Promise.resolve(ctc)
                })
              })
          })
      )
    )
  }

  contactOfService(ctcs: Array<models.ContactDto>, svcId: string): models.ContactDto | undefined {
    let latestContact: models.ContactDto | undefined = undefined
    let latestService: models.ServiceDto
    ctcs.forEach(c => {
      const s: models.ServiceDto | undefined = c.services!.find(it => svcId === it.id)
      if (s && (!latestService || moment(s.valueDate).isAfter(moment(latestService.valueDate)))) {
        latestContact = c
        latestService = s
      }
    })
    return latestContact
  }

  filteredServices(ctcs: Array<models.ContactDto>, filter: any): Array<models.ServiceDto> {
    const byIds: { [key: string]: models.ServiceDto } = {}
    ctcs.forEach(c =>
      (c.services || []).filter(s => filter(s, c)).forEach(s => {
        const ps = byIds[s.id!]
        if (!ps || !ps.modified || (s.modified && ps.modified < s.modified)) {
          byIds[s.id!] = s
          s.contactId = c.id
        }
      })
    )
    return _.values(byIds).filter((s: any) => !s.deleted && !s.endOfLife)
  }

  //Return a promise
  filterServices(ctcs: Array<models.ContactDto>, filter: any): Promise<Array<models.ServiceDto>> {
    return Promise.resolve(this.filteredServices(ctcs, filter))
  }

  services(ctc: models.ContactDto, label: string) {
    return ctc.services!.filter(s => s.label === label)
  }

  preferredContent(svc: models.ServiceDto, lng: string) {
    return (
      svc &&
      svc.content &&
      (svc.content[lng] ||
        svc.content["fr"] ||
        (Object.keys(svc.content)[0] ? svc.content[Object.keys(svc.content)[0]] : null))
    )
  }

  shortServiceDescription(svc: models.ServiceDto, lng: string) {
    const c = this.preferredContent(svc, lng)
    return !c
      ? ""
      : c.stringValue ||
          ((c.numberValue || c.numberValue === 0) && c.numberValue) ||
          (c.measureValue &&
            "" +
              (c.measureValue.value || c.measureValue.value === 0 ? c.measureValue.value : "-") +
              (c.measureValue.unit ? " " + c.measureValue.unit : "")) ||
          (c.booleanValue && svc.label) ||
          (c.medicationValue ? this.medication().medicationToString(c.medicationValue, lng) : null)
  }

  medicationValue(svc: models.ServiceDto, lng: string) {
    const c =
      svc &&
      svc.content &&
      (svc.content[lng] ||
        svc.content["fr"] ||
        (Object.keys(svc.content)[0] ? svc.content[Object.keys(svc.content)[0]] : null))
    return c && c.medicationValue
  }

  contentHasData(c: any): boolean {
    return (
      c.stringValue ||
      c.numberValue ||
      c.measureValue ||
      c.booleanValue ||
      c.booleanValue === false ||
      c.medicationValue ||
      c.documentId
    )
  }

  localize(e: any, lng: string) {
    if (!e) {
      return null
    }
    return e[lng] || e.fr || e.en || e.nl
  }

  /**
   * Modifies the subcontacts this svc belongs to while minimizing the number of references to the svcs inside the subcontacts
   * After the invocation, there is at least one subcontact with provided poaId and heId that contains the svc
   * The svc is not removed from a previous subcontact it would belong to except if the new conditions are compatible
   * Note that undefined and null do not have the same meaning for formId
   * If formId is null: the subcontact which refers svc must have a null formId
   * If formId is undefined, the subcontact can have any value for formId
   *
   * When a svc does not exist yet in the current contact but exists in a previous contact, all the scs it was belonging to are
   * copied in the current contact
   *
   * @param ctc
   * @param user
   * @param ctcs
   * @param svc
   * @param formId
   * @param poaId aMap {heId2: [poaId11, poaId12], heId2: [poaId21] }
   * @param heId an Array of heIds, equivalent to poaIds = {heId: [], ...}
   * @param init
   * @returns {*}
   */

  promoteServiceInContact(
    ctc: models.ContactDto,
    user: models.UserDto,
    ctcs: Array<models.ContactDto>,
    svc: models.ServiceDto,
    formId: string,
    poaIds: { [key: string]: string[] },
    heIds: Array<string>,
    init: any
  ) {
    if (!ctc) {
      return null
    }
    const existing = ctc.services!.find(s => s.id === svc.id)
    const promoted = _.extend(_.extend(existing || {}, svc), {
      author: user.id,
      responsible: user.healthcarePartyId,
      modified: new Date().getTime()
    })
    if (!existing) {
      ;(ctc.services || (ctc.services = [])).push(promoted)
    }
    const currentScs = (ctc.subContacts || []).filter(csc =>
      (csc.services || []).some(s => s.serviceId === svc.id)
    )

    //Rearrange poaIds and heIds as a hierarchy
    const hierarchyOfHeAndPoaIds: { [key: string]: Array<any> } = {}
    ;(heIds || []).forEach(id => (hierarchyOfHeAndPoaIds[id] = []))
    Object.keys(poaIds || {}).forEach((k: string) => {
      const poas = hierarchyOfHeAndPoaIds[k]
      if (poas) {
        hierarchyOfHeAndPoaIds[k] = _.concat(poas, poaIds[k])
      } else {
        hierarchyOfHeAndPoaIds[k] = poaIds[k]
      }
    })

    const pastCtc =
      (svc.contactId && svc.contactId !== ctc.id && ctcs.find(c => c.id === svc.contactId)) ||
      ctcs.reduce(
        (
          selected: { s: models.ServiceDto | null; c: models.ContactDto | null },
          c: models.ContactDto
        ) => {
          const candidate = (c.services || []).find(s => s.id === svc.id)
          return ctc.id !== c.id &&
            candidate &&
            (selected.s === null || utils.before(selected.s.modified || 0, candidate.modified || 0))
            ? { s: candidate, c: c }
            : selected
        },
        { s: null, c: null }
      ).c
    //Make sure that all scs the svc was belonging to are copied inside the current contact
    pastCtc &&
      pastCtc
        .subContacts!.filter(psc => psc.services!.some(s => s.serviceId === svc.id))
        .forEach(psc => {
          const sameInCurrent = currentScs.find(
            csc =>
              csc.formId === psc.formId &&
              csc.planOfActionId === psc.planOfActionId &&
              csc.healthElementId === psc.healthElementId
          )
          if (sameInCurrent) {
            if (!sameInCurrent.services!.some(s => s.serviceId === svc.id)) {
              sameInCurrent.services!.push({ serviceId: svc.id })
            }
          } else {
            const newSubContact = _.assign(_.assign({}, psc), {
              services: [{ serviceId: svc.id }]
            })
            ctc.subContacts!.push(newSubContact)
            currentScs.push(newSubContact)
          }
        })

    Object.keys(
      hierarchyOfHeAndPoaIds && hierarchyOfHeAndPoaIds.size ? hierarchyOfHeAndPoaIds : { null: [] }
    ).forEach((heId: string | null) => {
      if (heId === "null") {
        heId = null
      }
      const subPoaIds = heId ? hierarchyOfHeAndPoaIds[heId] : []
      ;((subPoaIds || []).length ? subPoaIds : [null]).forEach(poaId => {
        //Create or assign subcontacts for all pairs he/poa (can be null/null)
        let sc = ctc.subContacts!.find(
          sc =>
            (formId == undefined || sc.formId === formId) &&
            sc.planOfActionId === poaId &&
            sc.healthElementId === heId
        )
        if (!sc) {
          ctc.subContacts!.push(
            (sc = new models.SubContactDto({
              formId: formId || undefined,
              planOfActionId: poaId,
              healthElementId: heId,
              services: []
            }))
          )
        }

        const currentSc =
          currentScs.find(aSc => sc === aSc) ||
          currentScs.find(
            aSc =>
              (!aSc.planOfActionId || aSc.planOfActionId === sc!.planOfActionId) &&
              (!aSc.healthElementId || aSc.healthElementId === sc!.healthElementId) &&
              (!aSc.formId || aSc.formId === sc!.formId)
          ) // Find a compatible sc: one that does not contain extra and ≠ information than the destination

        if (currentSc && currentSc !== sc) {
          currentSc.services!.splice(
            currentSc.services!.findIndex(link => link.serviceId === svc.id),
            1
          )
        }
        if (!sc.services!.some(s => s.serviceId === svc.id)) {
          sc.services!.push({ serviceId: svc.id! })
        }
      })
    })

    return (init && init(svc)) || svc
  }

  isNumeric(svc: models.ServiceDto, lng: string) {
    const c = this.preferredContent(svc, lng)
    return c && (c.measureValue || c.numberValue || c.numberValue == 0)
  }

  service() {
    return {
      newInstance: (user: models.UserDto, s: any) =>
        _.extend(
          {
            id: this.crypto.randomUuid(),
            _type: "org.taktik.icure.entities.embed.Service",
            created: new Date().getTime(),
            modified: new Date().getTime(),
            responsible: user.healthcarePartyId,
            author: user.id,
            codes: [],
            tags: [],
            content: {},
            valueDate: parseInt(moment().format("YYYYMMDDhhmmss"))
          },
          s
        )
    }
  }

  medication() {
    const regimenScores: any = {
      beforebreakfast: 70000,
      duringbreakfast: 80000,
      afterbreakfast: 90000,
      morning: 100000,
      betweenbreakfastandlunch: 103000,
      beforelunch: 113000,
      duringlunch: 123000,
      afterlunch: 130000,
      afternoon: 140000,
      betweenlunchanddinner: 160000,
      beforedinner: 180000,
      duringdinner: 190000,
      afterdinner: 200000,
      evening: 210000,
      betweendinnerandsleep: 213000,
      thehourofsleep: 220000,
      night: 230000,
      betweenmeals: 10000,
      aftermeal: 20000
    }

    const myself = {
      medicationNameToString: function(m: any): string {
        return m.compoundPrescription
          ? m.compoundPrescription
          : m.substanceProduct
            ? myself.productToString(m.substanceProduct)
            : myself.productToString(m.medicinalProduct)
      },
      medicationToString: (m: any, lang: string) => {
        let res = `${myself.medicationNameToString(m)}, ${myself.posologyToString(m, lang)}`
        res = m.numberOfPackages
          ? `${m.numberOfPackages} ${
              m.numberOfPackages > 1 ? this.i18n[lang].packagesOf : this.i18n[lang].packageOf
            } ${res}`
          : res
        res = m.duration
          ? `${res} ${this.i18n[lang].during} ${myself.durationToString(m.duration, lang)}`
          : res
        return res
      },
      productToString: (m: any): string => {
        if (!m) {
          return ""
        }
        return m.intendedname
      },
      posologyToString: (m: any, lang: string) => {
        if (m.instructionForPatient && m.instructionForPatient.length) {
          return m.instructionForPatient
        }
        if (!m.regimen || !m.regimen.length) {
          return ""
        }

        let unit =
          m.regimen[0].administratedQuantity &&
          m.regimen[0].administratedQuantity.administrationUnit
            ? m.regimen[0].administratedQuantity.administrationUnit.code
            : m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.unit
        let quantity =
          m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.quantity

        m.regimen.slice(1).find((ri: any) => {
          let oUnit =
            ri.administratedQuantity && ri.administratedQuantity.administrationUnit
              ? ri.administratedQuantity.administrationUnit.code
              : ri.administratedQuantity && ri.administratedQuantity.unit
          let oQuantity = ri.administratedQuantity && ri.administratedQuantity.quantity

          if (oQuantity !== quantity) {
            quantity = -1
          }
          return oUnit !== unit && oQuantity !== quantity
        })

        const cplxRegimen = !unit || quantity < 0
        const quantityUnit = cplxRegimen
          ? `1 ${this.i18n[lang].take_s_}`
          : `${quantity} ${unit || this.i18n[lang].take_s_}`

        const dayPeriod = m.regimen.find((r: any) => r.weekday !== null && r.weekday !== undefined)
          ? this.i18n[lang].weekly
          : m.regimen.find((r: any) => r.date)
            ? this.i18n[lang].monthly
            : this.i18n[lang].daily

        return `${quantityUnit}, ${m.regimen.length} x ${dayPeriod}, ${_.sortBy(
          m.regimen,
          r =>
            (r.date ? r.date * 1000000 : 29990000000000) +
            (r.dayNumber || 0) * 1000000 +
            ((r.weekday && r.weekday.weekNumber) || 0) * 7 * 1000000 +
            (r.timeOfDay
              ? r.timeOfDay
              : r.dayPeriod && r.dayPeriod.code
                ? (regimenScores[r.dayPeriod.code] as number)
                : 0)
        )
          .map(
            r =>
              cplxRegimen ? myself.regimenToExtString(r, lang) : myself.regimenToString(r, lang)
          )
          .join(", ")}`
      },
      durationToString: (d: models.DurationDto, lang: string) => {
        return d.value ? `${d.value} ${this.localize(d.unit!.label, lang)}` : ""
      },
      regimenToExtString: (r: models.RegimenItemDto, lang: string) => {
        const desc = myself.regimenToString(r, lang)
        return (
          (r.administratedQuantity && r.administratedQuantity.quantity && desc
            ? `${desc} (${r.administratedQuantity.quantity} ${(r.administratedQuantity
                .administrationUnit
                ? r.administratedQuantity.administrationUnit.code
                : r.administratedQuantity.unit) || this.i18n[lang].take_s_})`
            : desc) || ""
        )
      },
      regimenToString: (r: models.RegimenItemDto, lang: string) => {
        let res = r.date
          ? `${this.i18n[lang].the} ${moment(r.date).format("DD/MM/YYYY")}`
          : r.dayNumber
            ? `${this.i18n[lang].onDay} ${r.dayNumber}`
            : r.weekday && r.weekday.weekday
              ? `${this.i18n[lang].on} ${r.weekday.weekday}`
              : null
        if (r.dayPeriod && r.dayPeriod.code && r.dayPeriod.code.length) {
          res = res
            ? `${res} ${this.i18n[lang][r.dayPeriod.code] ||
                this.localize(r.dayPeriod.label, lang) ||
                r.dayPeriod.code}`
            : this.i18n[lang][r.dayPeriod.code] ||
              this.localize(r.dayPeriod.label, lang) ||
              r.dayPeriod.code
        }
        if (r.timeOfDay) {
          const timeOfDay =
            r.timeOfDay === 120000
              ? this.i18n[lang].noon
              : `${Math.floor(r.timeOfDay / 10000)}:${(
                  "" +
                  (Math.floor(r.timeOfDay / 100) % 100)
                ).replace(/^(.)$/, "0$1")}`
          res = res ? res + " " + this.i18n[lang].at + " " + timeOfDay : timeOfDay
        }
        return res
      },
      localize: (s: any, lang: string) => {
        if (!s) {
          return s
        }
        return (
          this.i18n[lang][s] ||
          (this.i18n[lang][s.toLowerCase()] &&
            this.i18n[lang][s.toLowerCase()]
              .split("")
              .map(
                (c: string, idx: number) =>
                  idx >= s.length || s[idx].toLocaleLowerCase() === s[idx]
                    ? c
                    : c.toLocaleUpperCase()
              )
              .join("")) ||
          s
        ) //Applies the (lower/upper)case to the translated lowercase version of the input string (s)
      }
    }
    return myself
  }
}
