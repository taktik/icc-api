"use strict"
var __awaiter =
  (this && this.__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value))
        } catch (e) {
          reject(e)
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : new P(function(resolve) {
              resolve(result.value)
            }).then(fulfilled, rejected)
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const _ = require("lodash")
const models_1 = require("../icc-api/model/models")
const net_utils_1 = require("./utils/net-utils")
const utils_1 = require("./crypto/utils")
const models_2 = require("../icc-api/model/models")
// noinspection JSUnusedGlobalSymbols
class IccPatientXApi extends iccApi_1.iccPatientApi {
  constructor(
    host,
    headers,
    crypto,
    contactApi,
    formApi,
    helementApi,
    invoiceApi,
    documentApi,
    hcpartyApi,
    classificationApi,
    calendarItemaApi,
    cryptedKeys = ["note"],
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.contactApi = contactApi
    this.formApi = formApi
    this.helementApi = helementApi
    this.invoiceApi = invoiceApi
    this.hcpartyApi = hcpartyApi
    this.documentApi = documentApi
    this.classificationApi = classificationApi
    this.calendarItemApi = calendarItemaApi
    this.cryptedKeys = cryptedKeys
  }
  // noinspection JSUnusedGlobalSymbols
  newInstance(user, p) {
    const patient = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Patient",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId || user.patientId,
        author: user.id,
        codes: [],
        tags: []
      },
      p || {}
    )
    return this.initDelegations(patient, user)
  }
  initDelegations(patient, user, secretForeignKey) {
    return this.crypto
      .initObjectDelegations(
        patient,
        null,
        user.healthcarePartyId || user.patientId,
        secretForeignKey || null
      )
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
                  user.healthcarePartyId || user.patientId,
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
  initConfidentialDelegation(patient, user) {
    const ownerId = user.healthcarePartyId || user.patientId
    return this.crypto.extractPreferredSfk(patient, ownerId, true).then(k => {
      if (!k) {
        const secretId = this.crypto.randomUuid()
        return this.crypto
          .decryptAndImportAesHcPartyKeysForDelegators([ownerId], ownerId)
          .then(hcPartyKeys => {
            return this.crypto.AES.encrypt(
              hcPartyKeys[0].key,
              utils_1.utils.text2ua(patient.id + ":" + secretId).buffer
            )
          })
          .then(newDelegation => {
            ;(patient.delegations[ownerId] || (patient.delegations[ownerId] = [])).push(
              new models_2.DelegationDto({
                owner: ownerId,
                delegatedTo: ownerId,
                tag: "confidential",
                key: this.crypto.utils.ua2hex(newDelegation)
              })
            )
            return patient.rev
              ? this.modifyPatientWithUser(user, patient)
              : this.createPatientWithUser(user, patient)
          })
      } else {
        return patient
      }
    })
  }
  createPatient(body) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  createPatientWithUser(user, body) {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then(pats => super.createPatient(pats[0]))
          .then(p => this.decrypt(user, [p]))
          .then(pats => pats[0])
      : Promise.resolve(null)
  }
  filterBy(startKey, startDocumentId, limit, skip, sort, desc, body) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  filterByWithUser(user, startKey, startDocumentId, limit, skip, sort, desc, body) {
    return super
      .filterBy(startKey, startDocumentId, limit, skip, sort, desc, body)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  findByAccessLogUserAfterDate(userId, accessType, startDate, startKey, startDocumentId, limit) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  findByAccessLogUserAfterDateWithUser(
    user,
    userId,
    accessType,
    startDate,
    startKey,
    startDocumentId,
    limit
  ) {
    return super
      .findByAccessLogUserAfterDate(userId, accessType, startDate, startKey, startDocumentId, limit)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  findByAccessLogUserAfterDate_1(externalId) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  findByExternalIdWithUser(user, externalId) {
    return super.findByExternalId(externalId).then(pats => this.decrypt(user, pats))
  }
  findByNameBirthSsinAuto(
    healthcarePartyId,
    filterValue,
    startKey,
    startDocumentId,
    limit,
    sortDirection
  ) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  findByNameBirthSsinAutoWithUser(
    user,
    healthcarePartyId,
    filterValue,
    startKey,
    startDocumentId,
    limit,
    sortDirection
  ) {
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
  fuzzySearch(firstName, lastName, dateOfBirth) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  fuzzySearchWithUser(user, firstName, lastName, dateOfBirth) {
    return super
      .fuzzySearch(firstName, lastName, dateOfBirth)
      .then(pats => this.decrypt(user, pats))
  }
  getPatient(patientId) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  getPatientRaw(patientId) {
    return super.getPatient(patientId)
  }
  getPatientWithUser(user, patientId) {
    return super
      .getPatient(patientId)
      .then(p => this.decrypt(user, [p]))
      .then(pats => pats[0])
  }
  getPatients(body) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  getPatientsWithUser(user, body) {
    return super.getPatients(body).then(pats => this.decrypt(user, pats))
  }
  listDeletedPatients(startDate, endDate, desc, startDocumentId, limit) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  listDeletedPatientsWithUser(user, startDate, endDate, desc, startDocumentId, limit) {
    return super
      .listDeletedPatients(startDate, endDate, desc, startDocumentId, limit)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  listDeletedPatients_2(firstName, lastName) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  listDeletedPatientsByNameWithUser(user, firstName, lastName) {
    return super
      .listDeletedPatientsByName(firstName, lastName)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  listOfMergesAfter(date) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  listOfMergesAfterWithUser(user, date) {
    return super.listOfMergesAfter(date).then(pats => this.decrypt(user, pats, false))
  }
  listOfPatientsModifiedAfter(date, startKey, startDocumentId, limit) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  listOfPatientsModifiedAfterWithUser(user, date, startKey, startDocumentId, limit) {
    return super
      .listOfPatientsModifiedAfter(date, startKey, startDocumentId, limit)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  listPatients(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  listPatientsWithUser(
    user,
    hcPartyId,
    sortField,
    startKey,
    startDocumentId,
    limit,
    sortDirection
  ) {
    return super
      .listPatients(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  listPatientsByHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  listPatientsByHcPartyWithUser(
    user,
    hcPartyId,
    sortField,
    startKey,
    startDocumentId,
    limit,
    sortDirection
  ) {
    return super
      .listPatientsByHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  listPatientsOfHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  listPatientsOfHcPartyWithUser(
    user,
    hcPartyId,
    sortField,
    startKey,
    startDocumentId,
    limit,
    sortDirection
  ) {
    return super
      .listPatientsOfHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then(pl => this.decrypt(user, pl.rows, false).then(dr => Object.assign(pl, { rows: dr })))
  }
  mergeInto(toId, fromIds) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  mergeIntoWithUser(user, toId, fromIds) {
    return super
      .mergeInto(toId, fromIds)
      .then(p => this.decrypt(user, [p]))
      .then(pats => pats[0])
  }
  modifyPatient(body) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  modifyPatientRaw(body) {
    return super.modifyPatient(body)
  }
  modifyPatientWithUser(user, body) {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then(pats => super.modifyPatient(pats[0]))
          .then(p => this.decrypt(user, [p]))
          .then(pats => pats[0])
      : Promise.resolve(null)
  }
  modifyPatientReferral(patientId, referralId, start, end) {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }
  modifyPatientReferralWithUser(user, patientId, referralId, start, end) {
    return super
      .modifyPatientReferral(patientId, referralId, start, end)
      .then(p => this.decrypt(user, [p]))
      .then(pats => pats[0])
  }
  encrypt(user, pats) {
    return Promise.all(
      pats.map(p =>
        (p.encryptionKeys && Object.keys(p.encryptionKeys).length
          ? Promise.resolve(p)
          : this.initEncryptionKeys(user, p)
        )
          .then(p =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(
              user.healthcarePartyId || user.patientId,
              p.id,
              p.encryptionKeys
            )
          )
          .then(sfks =>
            this.crypto.AES.importKey(
              "raw",
              utils_1.utils.hex2ua(sfks.extractedKeys[0].replace(/-/g, ""))
            )
          )
          .then(key =>
            utils_1.utils.crypt(
              p,
              obj => this.crypto.AES.encrypt(key, utils_1.utils.utf82ua(JSON.stringify(obj))),
              this.cryptedKeys
            )
          )
      )
    )
  }
  decrypt(user, pats, fillDelegations = true) {
    return (user.healthcarePartyId
      ? this.hcpartyApi
          .getHealthcareParty(user.healthcarePartyId)
          .then(hcp => [hcp.id, hcp.parentId])
      : Promise.resolve([user.patientId])
    ).then(ids => {
      const hcpId = ids[0]
      //First check that we have no dangling delegation
      const patsWithMissingDelegations = pats.filter(
        p =>
          p.delegations &&
          ids.some(id => p.delegations[id] && !p.delegations[id].length) &&
          !Object.values(p.delegations).some(d => d.length > 0)
      )
      let prom = Promise.resolve({})
      fillDelegations &&
        patsWithMissingDelegations.forEach(p => {
          prom = prom.then(acc =>
            this.initDelegations(p, user).then(p =>
              this.modifyPatientWithUser(user, p).then(mp => {
                acc[p.id] = mp || p
                return acc
              })
            )
          )
        })
      return prom
        .then(acc =>
          pats.map(p => {
            const fixedPatient = acc[p.id]
            return fixedPatient || p
          })
        )
        .then(pats => {
          return Promise.all(
            pats.map(p => {
              return p.encryptedSelf
                ? this.crypto
                    .extractKeysFromDelegationsForHcpHierarchy(
                      hcpId,
                      p.id,
                      _.size(p.encryptionKeys) ? p.encryptionKeys : p.delegations
                    )
                    .then(({ extractedKeys: sfks }) => {
                      if (!sfks || !sfks.length) {
                        //console.log("Cannot decrypt contact", ctc.id)
                        return Promise.resolve(p)
                      }
                      return this.crypto.AES.importKey(
                        "raw",
                        utils_1.utils.hex2ua(sfks[0].replace(/-/g, ""))
                      ).then(key =>
                        utils_1.utils.decrypt(p, ec =>
                          this.crypto.AES.decrypt(key, ec)
                            .then(dec => {
                              const jsonContent = dec && utils_1.utils.ua2utf8(dec)
                              try {
                                return JSON.parse(jsonContent)
                              } catch (e) {
                                console.log(
                                  "Cannot parse patient",
                                  p.id,
                                  jsonContent || "Invalid content"
                                )
                                return p
                              }
                            })
                            .catch(err => {
                              console.log("Cannot decrypt patient", p.id, err)
                              return p
                            })
                        )
                      )
                    })
                : Promise.resolve(p)
            })
          )
        })
    })
  }
  initEncryptionKeys(user, pat) {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(pat, hcpId).then(eks => {
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
          (promise = promise.then(patient =>
            this.crypto
              .appendEncryptionKeys(patient, hcpId, delegateId, eks.secretId)
              .then(extraEks => {
                return _.extend(patient, {
                  encryptionKeys: extraEks.encryptionKeys
                })
              })
              .catch(e => {
                console.log(e.message)
                return patient
              })
          ))
      )
      return promise
    })
  }
  share(user, patId, ownerId, delegateIds, delegationTags) {
    const addDelegationsAndKeys = (dtos, markerPromise, delegateId, patient) => {
      return dtos.reduce(
        (p, x) =>
          p.then(() =>
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
          ),
        markerPromise
      )
    }
    return this.hcpartyApi.getHealthcareParty(ownerId).then(hcp => {
      const parentId = hcp.parentId
      const allTags = _.uniq(_.flatMap(Object.values(delegationTags)))
      const status = {
        contacts: {
          success: allTags.includes("medicalInformation") || allTags.includes("all") ? false : null,
          error: null
        },
        forms: {
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
        calendarItems: {
          success: allTags.includes("medicalInformation") || allTags.includes("all") ? false : null,
          error: null
        },
        patient: { success: false, error: null }
      }
      return net_utils_1
        .retry(() => this.getPatientWithUser(user, patId))
        .then(
          patient =>
            patient.encryptionKeys && Object.keys(patient.encryptionKeys || {}).length
              ? Promise.resolve(patient)
              : this.initEncryptionKeys(user, patient).then(patient =>
                  this.modifyPatientWithUser(user, patient)
                )
        )
        .then(patient => {
          if (!patient) {
            status.patient = {
              success: false,
              error: new Error("Patient does not exist or cannot initialise encryption keys")
            }
            return Promise.resolve({ patient: patient, statuses: status })
          }
          return this.crypto
            .extractDelegationsSFKsAndEncryptionSKs(patient, ownerId)
            .then(([delSfks, ecKeys]) => {
              return delSfks.length
                ? Promise.all([
                    net_utils_1.retry(() =>
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
                    ),
                    net_utils_1.retry(() =>
                      this.formApi
                        .findDelegationsStubsByHCPartyPatientSecretFKeys(ownerId, delSfks.join(","))
                        .then(
                          frms =>
                            parentId
                              ? this.formApi
                                  .findDelegationsStubsByHCPartyPatientSecretFKeys(
                                    parentId,
                                    delSfks.join(",")
                                  )
                                  .then(moreFrms => _.uniqBy(frms.concat(moreFrms), "id"))
                              : frms
                        )
                    ),
                    net_utils_1.retry(() =>
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
                    ),
                    net_utils_1.retry(() =>
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
                    ),
                    net_utils_1.retry(() =>
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
                    ),
                    net_utils_1.retry(() =>
                      this.calendarItemApi
                        .findByHCPartyPatientSecretFKeys(ownerId, delSfks.join(","))
                        .then(
                          cls =>
                            parentId
                              ? this.calendarItemApi
                                  .findByHCPartyPatientSecretFKeys(parentId, delSfks.join(","))
                                  .then(moreCls => _.uniqBy(cls.concat(moreCls), "id"))
                              : cls
                        )
                    )
                  ]).then(([hes, frms, ctcs, ivs, cls, cis]) => {
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
                    const oFrms = frms.map(x =>
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
                    const oCis = cis.map(x =>
                      _.assign({}, x, {
                        delegations: _.clone(x.delegations),
                        cryptedForeignKeys: _.clone(x.cryptedForeignKeys),
                        encryptionKeys: _.clone(x.encryptionKeys)
                      })
                    )
                    const docIds = {}
                    ctcs.forEach(
                      c =>
                        c.services &&
                        c.services.forEach(
                          s =>
                            s.content &&
                            Object.values(s.content).forEach(
                              c => c.documentId && (docIds[c.documentId] = 1)
                            )
                        )
                    )
                    return net_utils_1
                      .retry(() =>
                        this.documentApi.getDocuments(
                          new models_1.ListOfIdsDto({ ids: Object.keys(docIds) })
                        )
                      )
                      .then(docs => {
                        const oDocs = docs.map(x =>
                          _.assign({}, x, {
                            delegations: _.clone(x.delegations),
                            cryptedForeignKeys: _.clone(x.cryptedForeignKeys),
                            encryptionKeys: _.clone(x.encryptionKeys)
                          })
                        )
                        let markerPromise = Promise.resolve(null)
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
                              .then(patient =>
                                __awaiter(this, void 0, void 0, function*() {
                                  if (delSfks.length > 1) {
                                    return delSfks.slice(1).reduce(
                                      (patientPromise, delSfk) =>
                                        __awaiter(this, void 0, void 0, function*() {
                                          const patient = yield patientPromise
                                          return this.crypto
                                            .addDelegationsAndEncryptionKeys(
                                              null,
                                              patient,
                                              ownerId,
                                              delegateId,
                                              delSfk,
                                              null
                                            )
                                            .catch(e => {
                                              console.log(e)
                                              return patient
                                            })
                                        }),
                                      Promise.resolve(patient)
                                    )
                                  }
                                  return patient
                                })
                              )
                              .catch(e => {
                                console.log(e)
                                return patient
                              })
                          })
                          ;(tags.includes("medicalInformation") || tags.includes("all")) &&
                            (markerPromise = addDelegationsAndKeys(
                              hes,
                              markerPromise,
                              delegateId,
                              patient
                            ))
                          ;(tags.includes("medicalInformation") || tags.includes("all")) &&
                            (markerPromise = addDelegationsAndKeys(
                              frms,
                              markerPromise,
                              delegateId,
                              patient
                            ))
                          ;(tags.includes("medicalInformation") || tags.includes("all")) &&
                            (markerPromise = addDelegationsAndKeys(
                              ctcsStubs,
                              markerPromise,
                              delegateId,
                              patient
                            ))
                          ;(tags.includes("medicalInformation") || tags.includes("all")) &&
                            (markerPromise = addDelegationsAndKeys(
                              cls,
                              markerPromise,
                              delegateId,
                              patient
                            ))
                          ;(tags.includes("medicalInformation") || tags.includes("all")) &&
                            (markerPromise = addDelegationsAndKeys(
                              cis,
                              markerPromise,
                              delegateId,
                              patient
                            ))
                          ;(tags.includes("financialInformation") || tags.includes("all")) &&
                            (markerPromise = addDelegationsAndKeys(
                              ivs,
                              markerPromise,
                              delegateId,
                              patient
                            ))
                          ;(tags.includes("medicalInformation") || tags.includes("all")) &&
                            (markerPromise = addDelegationsAndKeys(
                              docs,
                              markerPromise,
                              delegateId,
                              null
                            ))
                        })
                        return markerPromise
                          .then(() => {
                            console.log("scd")
                            return (
                              ((allTags.includes("medicalInformation") ||
                                allTags.includes("all")) &&
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
                              ((allTags.includes("medicalInformation") ||
                                allTags.includes("all")) &&
                                (hes && hes.length && !_.isEqual(oHes, hes)) &&
                                this.helementApi
                                  .setHealthElementsDelegations(hes)
                                  .then(() => (status.healthElements.success = true))
                                  .catch(e => (status.healthElements.error = e))) ||
                              Promise.resolve((status.healthElements.success = true))
                            )
                          })
                          .then(() => {
                            console.log("sfd")
                            return (
                              ((allTags.includes("medicalInformation") ||
                                allTags.includes("all")) &&
                                (frms && frms.length && !_.isEqual(oFrms, frms)) &&
                                this.formApi
                                  .setFormsDelegations(frms)
                                  .then(() => (status.forms.success = true))
                                  .catch(e => (status.forms.error = e))) ||
                              Promise.resolve((status.forms.success = true))
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
                              ((allTags.includes("medicalInformation") ||
                                allTags.includes("all")) &&
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
                              ((allTags.includes("medicalInformation") ||
                                allTags.includes("all")) &&
                                (cls && cls.length && !_.isEqual(oCls, cls)) &&
                                this.classificationApi
                                  .setClassificationsDelegations(cls)
                                  .then(() => (status.classifications.success = true))
                                  .catch(e => (status.classifications.error = e))) ||
                              Promise.resolve((status.classifications.success = true))
                            )
                          })
                          .then(() => {
                            console.log("scid")
                            return (
                              ((allTags.includes("medicalInformation") ||
                                allTags.includes("all")) &&
                                (cis && cis.length && !_.isEqual(oCis, cis)) &&
                                this.calendarItemApi
                                  .setCalendarItemsDelegations(cis)
                                  .then(() => (status.calendarItems.success = true))
                                  .catch(e => (status.calendarItems.error = e))) ||
                              Promise.resolve((status.calendarItems.success = true))
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
                            (acc, del) => Object.assign(acc, _.fromPairs([[del, []]])),
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
        })
    })
  }
  checkInami(inami) {
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
  isValidSsin(ssin) {
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
  getPatientIdOfChildDocumentForHcpAndHcpParents(childDocument, hcpId) {
    const _super = name => super[name]
    return __awaiter(this, void 0, void 0, function*() {
      const parentIdsArray = (yield this.crypto.extractCryptedFKs(childDocument, hcpId))
        .extractedKeys
      const multipleParentIds = _.uniq(parentIdsArray).length > 1
      if (multipleParentIds) {
        throw "Child document with id " +
          childDocument.id +
          " contains multiple parent ids in its CFKs for hcpId: " +
          hcpId
      }
      const parentId = _.first(parentIdsArray)
      if (!parentId) {
        throw "Parent id is empty in CFK of child document with id " +
          childDocument.id +
          " for hcpId: " +
          hcpId
      }
      let patient = yield _super("getPatient").call(this, parentId)
      let mergeLevel = 0
      const maxMergeLevel = 10
      while (patient.mergeToPatientId) {
        mergeLevel++
        if (mergeLevel === maxMergeLevel) {
          throw "Too many merged levels for parent (Patient) of child document " +
            childDocument.id +
            " ; hcpId: " +
            hcpId
        }
        patient = yield _super("getPatient").call(this, patient.mergeToPatientId)
      }
      return patient.id
    })
  }
}
exports.IccPatientXApi = IccPatientXApi
//# sourceMappingURL=icc-patient-x-api.js.map
