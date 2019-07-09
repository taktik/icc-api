import { iccPatientApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHcpartyXApi } from "./icc-hcparty-x-api"
import { IccInvoiceXApi } from "./icc-invoice-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"
import { IccHelementXApi } from "./icc-helement-x-api"
import { IccClassificationXApi } from "./icc-classification-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { DocumentDto, ListOfIdsDto } from "../icc-api/model/models"
import { retry } from "./utils/net-utils"
import { AES } from "./crypto/AES"
import { utils } from "./crypto/utils"

// noinspection JSUnusedGlobalSymbols
export class IccPatientXApi extends iccPatientApi {
  crypto: IccCryptoXApi
  contactApi: IccContactXApi
  helementApi: IccHelementXApi
  invoiceApi: IccInvoiceXApi
  hcpartyApi: IccHcpartyXApi
  documentApi: IccDocumentXApi
  classificationApi: IccClassificationXApi

  private cryptedKeys: Array<string>

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    contactApi: IccContactXApi,
    helementApi: IccHelementXApi,
    invoiceApi: IccInvoiceXApi,
    documentApi: IccDocumentXApi,
    hcpartyApi: IccHcpartyXApi,
    classificationApi: IccClassificationXApi,
    cryptedKeys: Array<string> = ["note"]
  ) {
    super(host, headers)
    this.crypto = crypto
    this.contactApi = contactApi
    this.helementApi = helementApi
    this.invoiceApi = invoiceApi
    this.hcpartyApi = hcpartyApi
    this.documentApi = documentApi
    this.classificationApi = classificationApi

    this.cryptedKeys = cryptedKeys
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.UserDto, p: any) {
    const patient = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Patient",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      p || {}
    )
    return this.initDelegations(patient, user)
  }

  initDelegations(
    patient: models.PatientDto,
    user: models.UserDto,
    secretForeignKey?: string
  ): Promise<models.PatientDto> {
    return this.crypto
      .initObjectDelegations(patient, null, user.healthcarePartyId!, secretForeignKey || null)
      .then(initData => {
        _.extend(patient, { delegations: initData.delegations })

        let promise = Promise.resolve(patient)
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
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
              )
              .then(extraData => _.extend(patient, { delegations: extraData.delegations }))
              .catch(e => {
                console.log(e)
                return patient
              }))
        )
        return promise
      })
  }

  createPatient(body?: models.PatientDto): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  createPatientWithUser(
    user: models.UserDto,
    body?: models.PatientDto
  ): Promise<models.PatientDto | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then(pats => super.createPatient(pats[0]))
          .then(p => this.decrypt(user, [p]))
          .then(pats => pats[0])
      : Promise.resolve(null)
  }

  filterBy(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    body?: models.FilterChain
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  filterByWithUser(
    user: models.UserDto,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    body?: models.FilterChain
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .filterBy(startKey, startDocumentId, limit, skip, sort, desc, body)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  findByAccessLogUserAfterDate(
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  findByAccessLogUserAfterDateWithUser(
    user: models.UserDto,
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .findByAccessLogUserAfterDate(userId, accessType, startDate, startKey, startDocumentId, limit)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  findByAccessLogUserAfterDate_1(externalId: string): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  findByExternalIdWithUser(
    user: models.UserDto,
    externalId: string
  ): Promise<models.PatientDto | any> {
    return super.findByExternalId(externalId).then(pats => this.decrypt(user, pats))
  }

  findByNameBirthSsinAuto(
    healthcarePartyId?: string,
    filterValue?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  findByNameBirthSsinAutoWithUser(
    user: models.UserDto,
    healthcarePartyId?: string,
    filterValue?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .findByNameBirthSsinAuto(
        healthcarePartyId,
        filterValue,
        startKey,
        startDocumentId,
        limit,
        sortDirection
      )
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  fuzzySearch(firstName?: string, lastName?: string, dateOfBirth?: number): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  fuzzySearchWithUser(
    user: models.UserDto,
    firstName?: string,
    lastName?: string,
    dateOfBirth?: number
  ): Promise<Array<models.PatientDto> | any> {
    return super
      .fuzzySearch(firstName, lastName, dateOfBirth)
      .then(pats => this.decrypt(user, pats))
  }

  getPatient(patientId: string): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  getPatientRaw(patientId: string): Promise<models.PatientDto | any> {
    return super.getPatient(patientId)
  }

  getPatientWithUser(user: models.UserDto, patientId: string): Promise<models.PatientDto | any> {
    return super
      .getPatient(patientId)
      .then(p => this.decrypt(user, [p]))
      .then(pats => pats[0])
  }

  getPatients(body?: models.ListOfIdsDto): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  getPatientsWithUser(
    user: models.UserDto,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.PatientDto> | any> {
    return super.getPatients(body).then(pats => this.decrypt(user, pats))
  }

  listDeletedPatients(
    startDate?: number,
    endDate?: number,
    desc?: boolean,
    startDocumentId?: string,
    limit?: number
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listDeletedPatientsWithUser(
    user: models.UserDto,
    startDate?: number,
    endDate?: number,
    desc?: boolean,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .listDeletedPatients(startDate, endDate, desc, startDocumentId, limit)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  listDeletedPatients_2(firstName?: string, lastName?: string): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listDeletedPatientsByNameWithUser(
    user: models.UserDto,
    firstName?: string,
    lastName?: string
  ): Promise<Array<models.PatientPaginatedList> | any> {
    return super
      .listDeletedPatientsByName(firstName, lastName)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  listOfMergesAfter(date: number): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listOfMergesAfterWithUser(
    user: models.UserDto,
    date: number
  ): Promise<Array<models.PatientDto> | any> {
    return super.listOfMergesAfter(date).then(pats => this.decrypt(user, pats, false))
  }

  listOfPatientsModifiedAfter(
    date: number,
    startKey?: number,
    startDocumentId?: string,
    limit?: number
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listOfPatientsModifiedAfterWithUser(
    user: models.UserDto,
    date: number,
    startKey?: number,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .listOfPatientsModifiedAfter(date, startKey, startDocumentId, limit)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  listPatients(
    hcPartyId?: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listPatientsWithUser(
    user: models.UserDto,
    hcPartyId?: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .listPatients(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  listPatientsByHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listPatientsByHcPartyWithUser(
    user: models.UserDto,
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .listPatientsByHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  listPatientsOfHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listPatientsOfHcPartyWithUser(
    user: models.UserDto,
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PatientPaginatedList | any> {
    return super
      .listPatientsOfHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }

  mergeInto(toId: string, fromIds: string): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  mergeIntoWithUser(
    user: models.UserDto,
    toId: string,
    fromIds: string
  ): Promise<models.PatientDto | any> {
    return super
      .mergeInto(toId, fromIds)
      .then(p => this.decrypt(user, [p]))
      .then(pats => pats[0])
  }

  modifyPatient(body?: models.PatientDto): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  modifyPatientRaw(body?: models.PatientDto): Promise<models.PatientDto | any> {
    return super.modifyPatient(body)
  }

  modifyPatientWithUser(
    user: models.UserDto,
    body?: models.PatientDto
  ): Promise<models.PatientDto | null> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then(pats => super.modifyPatient(pats[0]))
          .then(p => this.decrypt(user, [p]))
          .then(pats => pats[0])
      : Promise.resolve(null)
  }

  modifyPatientReferral(
    patientId: string,
    referralId: string,
    start?: number,
    end?: number
  ): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  modifyPatientReferralWithUser(
    user: models.UserDto,
    patientId: string,
    referralId: string,
    start?: number,
    end?: number
  ): Promise<models.PatientDto | any> {
    return super
      .modifyPatientReferral(patientId, referralId, start, end)
      .then(p => this.decrypt(user, [p]))
      .then(pats => pats[0])
  }

  encrypt(user: models.UserDto, pats: Array<models.PatientDto>): Promise<Array<models.PatientDto>> {
    return Promise.all(
      pats.map(p =>
        (p.encryptionKeys && Object.keys(p.encryptionKeys).length
          ? Promise.resolve(p)
          : this.initEncryptionKeys(user, p)
        )
          .then(p =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(
              user.healthcarePartyId!,
              p.id!,
              p.encryptionKeys!
            )
          )
          .then((sfks: { extractedKeys: Array<string>; hcpartyId: string }) =>
            AES.importKey("raw", utils.hex2ua(sfks.extractedKeys[0].replace(/-/g, "")))
          )
          .then((key: CryptoKey) =>
            utils.crypt(
              p,
              (obj: { [key: string]: string }) =>
                AES.encrypt(key, utils.utf82ua(JSON.stringify(obj))),
              this.cryptedKeys
            )
          )
      )
    )
  }

  decrypt(
    user: models.UserDto,
    pats: Array<models.PatientDto>,
    fillDelegations: boolean = true
  ): Promise<Array<models.PatientDto>> {
    const hcpId = user.healthcarePartyId || user.patientId
    //First check that we have no dangling delegation
    const patsWithMissingDelegations = pats.filter(
      p =>
        p.delegations &&
        p.delegations[hcpId!] &&
        !p.delegations[hcpId!].length &&
        !Object.values(p.delegations).some(d => d.length > 0)
    )

    let prom: Promise<{ [key: string]: models.PatientDto }> = Promise.resolve({})
    fillDelegations &&
      patsWithMissingDelegations.forEach(p => {
        prom = prom.then(acc =>
          this.initDelegations(p, user).then(p =>
            this.modifyPatientWithUser(user, p).then(mp => {
              acc[p.id!] = mp || p
              return acc
            })
          )
        )
      })

    return prom
      .then((acc: { [key: string]: models.PatientDto }) =>
        pats.map(p => {
          const fixedPatient = acc[p.id!]
          return fixedPatient || p
        })
      )
      .then(pats => {
        return Promise.all(
          pats.map(p => {
            return p.encryptedSelf
              ? this.crypto
                  .extractKeysFromDelegationsForHcpHierarchy(
                    hcpId!,
                    p.id!,
                    _.size(p.encryptionKeys) ? p.encryptionKeys! : p.delegations!
                  )
                  .then(({ extractedKeys: sfks }) => {
                    if (!sfks || !sfks.length) {
                      //console.log("Cannot decrypt contact", ctc.id)
                      return Promise.resolve(p)
                    }
                    return AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, ""))).then(key =>
                      utils.decrypt(p, ec =>
                        AES.decrypt(key, ec).then(dec => {
                          const jsonContent = dec && utils.ua2utf8(dec)
                          try {
                            return JSON.parse(jsonContent)
                          } catch (e) {
                            console.log(
                              "Cannot parse patient",
                              p.id,
                              jsonContent || "Invalid content"
                            )
                            return {}
                          }
                        })
                      )
                    )
                  })
              : Promise.resolve(p)
          })
        )
      })
  }

  initEncryptionKeys(user: models.UserDto, pat: models.PatientDto) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(pat, hcpId!).then(eks => {
      let promise = Promise.resolve(
        _.extend(pat, {
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
              .appendEncryptionKeys(contact, hcpId!, delegateId, eks.secretId)
              .then(extraEks => {
                return _.extend(contact, {
                  encryptionKeys: extraEks.encryptionKeys
                })
              })
              .catch(e => {
                console.log(e.message)
                return contact
              })
          ))
      )
      return promise
    })
  }

  share(
    user: models.UserDto,
    patId: string,
    ownerId: string,
    delegateIds: Array<string>,
    delegationTags: { [key: string]: Array<string> }
  ): Promise<{
    patient: models.PatientDto | null
    statuses: { [key: string]: { success: boolean | null; error: Error | null } }
  } | null> {
    return this.hcpartyApi.getHealthcareParty(ownerId).then(hcp => {
      const parentId = hcp.parentId
      const allTags = _.uniq(_.flatMap(Object.values(delegationTags)))
      const status = {
        contacts: {
          success: allTags.includes("medicalInformation") || allTags.includes("all") ? false : null,
          error: null
        },
        healthElements: {
          success: allTags.includes("medicalInformation") || allTags.includes("all") ? false : null,
          error: null
        },
        invoices: {
          success:
            allTags.includes("financialInformation") || allTags.includes("all") ? false : null,
          error: null
        },
        documents: {
          success: allTags.includes("medicalInformation") || allTags.includes("all") ? false : null,
          error: null
        },
        classifications: {
          success: allTags.includes("medicalInformation") || allTags.includes("all") ? false : null,
          error: null
        },
        patient: { success: false, error: null }
      }
      return retry(() => this.getPatientWithUser(user, patId)).then(
        (patient: models.PatientDto) => {
          return this.crypto
            .extractDelegationsSFKsAndEncryptionSKs(patient, ownerId)
            .then(([delSfks, ecKeys]) => {
              return delSfks.length
                ? Promise.all([
                    retry(() =>
                      this.helementApi
                        .findDelegationsStubsByHCPartyPatientSecretFKeys(ownerId, delSfks.join(","))
                        .then(
                          hes =>
                            parentId
                              ? this.helementApi
                                  .findDelegationsStubsByHCPartyPatientSecretFKeys(
                                    parentId,
                                    delSfks.join(",")
                                  )
                                  .then(moreHes => _.uniqBy(hes.concat(moreHes), "id"))
                              : hes
                        )
                    ) as Promise<Array<models.IcureStubDto>>,
                    retry(() =>
                      this.contactApi
                        .findByHCPartyPatientSecretFKeys(ownerId, delSfks.join(","))
                        .then(
                          ctcs =>
                            parentId
                              ? this.contactApi
                                  .findByHCPartyPatientSecretFKeys(parentId, delSfks.join(","))
                                  .then(moreCtcs => _.uniqBy(ctcs.concat(moreCtcs), "id"))
                              : ctcs
                        )
                    ) as Promise<Array<models.ContactDto>>,
                    retry(() =>
                      this.invoiceApi
                        .findDelegationsStubsByHCPartyPatientSecretFKeys(ownerId, delSfks.join(","))
                        .then(
                          ivs =>
                            parentId
                              ? this.invoiceApi
                                  .findDelegationsStubsByHCPartyPatientSecretFKeys(
                                    parentId,
                                    delSfks.join(",")
                                  )
                                  .then(moreIvs => _.uniqBy(ivs.concat(moreIvs), "id"))
                              : ivs
                        )
                    ) as Promise<Array<models.IcureStubDto>>,
                    retry(() =>
                      this.classificationApi
                        .findByHCPartyPatientSecretFKeys(ownerId, delSfks.join(","))
                        .then(
                          cls =>
                            parentId
                              ? this.classificationApi
                                  .findByHCPartyPatientSecretFKeys(parentId, delSfks.join(","))
                                  .then(moreCls => _.uniqBy(cls.concat(moreCls), "id"))
                              : cls
                        )
                    ) as Promise<Array<models.ClassificationDto>>
                  ]).then(([hes, ctcs, ivs, cls]) => {
                    const ctcsStubs = ctcs.map(c => ({
                      id: c.id,
                      rev: c.rev,
                      delegations: _.clone(c.delegations),
                      cryptedForeignKeys: _.clone(c.cryptedForeignKeys),
                      encryptionKeys: _.clone(c.encryptionKeys)
                    }))
                    const oHes = hes.map(x =>
                      _.assign({}, x, {
                        delegations: _.clone(x.delegations),
                        cryptedForeignKeys: _.clone(x.cryptedForeignKeys),
                        encryptionKeys: _.clone(x.encryptionKeys)
                      })
                    )
                    const oCtcsStubs = ctcsStubs.map(x =>
                      _.assign({}, x, {
                        delegations: _.clone(x.delegations),
                        cryptedForeignKeys: _.clone(x.cryptedForeignKeys),
                        encryptionKeys: _.clone(x.encryptionKeys)
                      })
                    )
                    const oIvs = ivs.map(x =>
                      _.assign({}, x, {
                        delegations: _.clone(x.delegations),
                        cryptedForeignKeys: _.clone(x.cryptedForeignKeys),
                        encryptionKeys: _.clone(x.encryptionKeys)
                      })
                    )
                    const oCls = cls.map(x =>
                      _.assign({}, x, {
                        delegations: _.clone(x.delegations),
                        cryptedForeignKeys: _.clone(x.cryptedForeignKeys),
                        encryptionKeys: _.clone(x.encryptionKeys)
                      })
                    )

                    const docIds: { [key: string]: number } = {}
                    ctcs.forEach(
                      (c: models.ContactDto) =>
                        c.services &&
                        c.services.forEach(
                          s =>
                            s.content &&
                            Object.values(s.content).forEach(
                              c => c.documentId && (docIds[c.documentId] = 1)
                            )
                        )
                    )

                    return retry(() =>
                      this.documentApi.getDocuments(new ListOfIdsDto({ ids: Object.keys(docIds) }))
                    ).then((docs: Array<DocumentDto>) => {
                      const oDocs = docs.map(x =>
                        _.assign({}, x, {
                          delegations: _.clone(x.delegations),
                          cryptedForeignKeys: _.clone(x.cryptedForeignKeys),
                          encryptionKeys: _.clone(x.encryptionKeys)
                        })
                      )

                      let markerPromise: Promise<any> = Promise.resolve(null)
                      delegateIds.forEach(delegateId => {
                        const tags = delegationTags[delegateId]
                        markerPromise = markerPromise.then(() => {
                          //Share patient
                          console.log(`share ${patient.id} to ${delegateId}`)
                          return this.crypto
                            .addDelegationsAndEncryptionKeys(
                              null,
                              patient,
                              ownerId,
                              delegateId,
                              delSfks[0],
                              ecKeys[0]
                            )
                            .catch(e => {
                              console.log(e)
                              return patient
                            })
                        })
                        tags.includes("medicalInformation") ||
                          (tags.includes("all") &&
                            hes.forEach(
                              x =>
                                (markerPromise = markerPromise.then(() =>
                                  Promise.all([
                                    this.crypto.extractDelegationsSFKs(x, ownerId),
                                    this.crypto.extractEncryptionsSKs(x, ownerId)
                                  ]).then(([sfks, eks]) => {
                                    console.log(`share ${x.id} to ${delegateId}`)
                                    return this.crypto
                                      .addDelegationsAndEncryptionKeys(
                                        patient,
                                        x,
                                        ownerId,
                                        delegateId,
                                        sfks.extractedKeys[0],
                                        eks.extractedKeys[0]
                                      )
                                      .catch(e => {
                                        console.log(e)
                                        return x
                                      })
                                  })
                                ))
                            ))
                        tags.includes("medicalInformation") ||
                          (tags.includes("all") &&
                            ctcsStubs.forEach(
                              x =>
                                (markerPromise = markerPromise.then(() =>
                                  Promise.all([
                                    this.crypto.extractDelegationsSFKs(x, ownerId),
                                    this.crypto.extractEncryptionsSKs(x, ownerId)
                                  ]).then(([sfks, eks]) => {
                                    console.log(`share ${patient.id} to ${delegateId}`)
                                    return this.crypto
                                      .addDelegationsAndEncryptionKeys(
                                        patient,
                                        x,
                                        ownerId,
                                        delegateId,
                                        sfks.extractedKeys[0],
                                        eks.extractedKeys[0]
                                      )
                                      .catch(e => {
                                        console.log(e)
                                        return x
                                      })
                                  })
                                ))
                            ))
                        tags.includes("financialInformation") ||
                          (tags.includes("all") &&
                            ivs.forEach(
                              x =>
                                (markerPromise = markerPromise.then(() =>
                                  Promise.all([
                                    this.crypto.extractDelegationsSFKs(x, ownerId),
                                    this.crypto.extractEncryptionsSKs(x, ownerId)
                                  ]).then(([sfks, eks]) => {
                                    console.log(`share ${patient.id} to ${delegateId}`)
                                    return this.crypto
                                      .addDelegationsAndEncryptionKeys(
                                        patient,
                                        x,
                                        ownerId,
                                        delegateId,
                                        sfks.extractedKeys[0],
                                        eks.extractedKeys[0]
                                      )
                                      .catch(e => {
                                        console.log(e)
                                        return x
                                      })
                                  })
                                ))
                            ))
                        tags.includes("medicalInformation") ||
                          (tags.includes("all") &&
                            docs.forEach(
                              (x: DocumentDto) =>
                                (markerPromise = markerPromise.then(() =>
                                  Promise.all([
                                    this.crypto.extractDelegationsSFKs(x, ownerId),
                                    this.crypto.extractEncryptionsSKs(x, ownerId)
                                  ]).then(([sfks, eks]) => {
                                    console.log(`share ${patient.id} to ${delegateId}`)
                                    return this.crypto
                                      .addDelegationsAndEncryptionKeys(
                                        patient,
                                        x,
                                        ownerId,
                                        delegateId,
                                        sfks.extractedKeys[0],
                                        eks.extractedKeys[0]
                                      )
                                      .catch(e => {
                                        console.log(e)
                                        return x
                                      })
                                  })
                                ))
                            ))
                      })
                      return markerPromise
                        .then(() => {
                          console.log("scd")
                          return (
                            ((allTags.includes("medicalInformation") || allTags.includes("all")) &&
                              (ctcsStubs &&
                                ctcsStubs.length &&
                                !_.isEqual(oCtcsStubs, ctcsStubs)) &&
                              this.contactApi
                                .setContactsDelegations(ctcsStubs)
                                .then(() => (status.contacts.success = true))
                                .catch(e => (status.contacts.error = e))) ||
                            Promise.resolve((status.contacts.success = true))
                          )
                        })
                        .then(() => {
                          console.log("shed")
                          return (
                            ((allTags.includes("medicalInformation") || allTags.includes("all")) &&
                              (hes && hes.length && !_.isEqual(oHes, hes)) &&
                              this.helementApi
                                .setHealthElementsDelegations(hes)
                                .then(() => (status.healthElements.success = true))
                                .catch(e => (status.healthElements.error = e))) ||
                            Promise.resolve((status.healthElements.success = true))
                          )
                        })
                        .then(() => {
                          console.log("sid")
                          return (
                            ((allTags.includes("financialInformation") ||
                              allTags.includes("all")) &&
                              (ivs && ivs.length && !_.isEqual(oIvs, ivs)) &&
                              this.invoiceApi
                                .setInvoicesDelegations(ivs)
                                .then(() => (status.invoices.success = true))
                                .catch(e => (status.invoices.error = e))) ||
                            Promise.resolve((status.invoices.success = true))
                          )
                        })
                        .then(() => {
                          console.log("sdd")
                          return (
                            ((allTags.includes("medicalInformation") || allTags.includes("all")) &&
                              (docs && docs.length && !_.isEqual(oDocs, docs)) &&
                              this.documentApi
                                .setDocumentsDelegations(docs)
                                .then(() => (status.documents.success = true))
                                .catch(e => (status.documents.error = e))) ||
                            Promise.resolve((status.documents.success = true))
                          )
                        })
                        .then(() => {
                          console.log("scld")
                          return (
                            ((allTags.includes("medicalInformation") || allTags.includes("all")) &&
                              (cls && cls.length && !_.isEqual(oCls, cls)) &&
                              this.classificationApi
                                .setClassificationsDelegations(cls)
                                .then(() => (status.classifications.success = true))
                                .catch(e => (status.classifications.error = e))) ||
                            Promise.resolve((status.classifications.success = true))
                          )
                        })
                        .then(() => this.modifyPatientWithUser(user, patient))
                        .then(p => {
                          status.patient.success = true
                          return { patient: p, statuses: status }
                        })
                        .catch(e => {
                          status.patient.error = e
                          return { patient: patient, statuses: status }
                        })
                    })
                  })
                : this.modifyPatientWithUser(
                    user,
                    _.assign(patient, {
                      delegations: _.assign(
                        patient.delegations,
                        delegateIds
                          .filter(id => !patient.delegations || !patient.delegations[id]) //If there are delegations do not modify
                          .reduce(
                            (acc, del: String) => Object.assign(acc, _.fromPairs([[del, []]])),
                            patient.delegations || {}
                          )
                      )
                    })
                  )
                    .then(p => {
                      status.patient.success = true
                      return { patient: p, statuses: status }
                    })
                    .catch(e => {
                      status.patient.error = e
                      return { patient: patient, statuses: status }
                    })
            })
        }
      )
    })
  }

  checkInami(inami: String): Boolean {
    const num_inami = inami.replace(new RegExp("[^(0-9)]", "g"), "")

    const checkDigit = num_inami.substr(6, 2)
    const numSansCheck = num_inami.substr(0, 6)
    let retour = false

    //modulo du niss
    const modINAMI = parseInt(numSansCheck) % 97

    //obtention du num de check 97 - le resultat du mod
    const checkDigit_2 = 97 - modINAMI

    if (parseInt(checkDigit) == checkDigit_2) {
      retour = true
    }
    return retour
  }

  isValidSsin(ssin: string) {
    ssin = ssin.replace(new RegExp("[^(0-9)]", "g"), "")
    let isValidNiss = false

    const normalNumber = /^[0-9][0-9](([0][0-9])|([1][0-2]))(([0-2][0-9])|([3][0-1]))(([0-9]{2}[1-9])|([0-9][1-9][0-9])|([1-9][0-9]{2}))(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )
    const bisNumber = /^[0-9][0-9](([2][0-9])|([3][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )
    const terNumber = /^[0-9][0-9](([4][0-9])|([5][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )

    if (normalNumber || bisNumber || terNumber) {
      isValidNiss =
        97 - (Number(ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
          ? true
          : 97 - (Number("2" + ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
    }

    return isValidNiss
  }
}
