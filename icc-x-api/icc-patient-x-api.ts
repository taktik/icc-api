import { iccDocumentApi, iccHelementApi, iccInvoiceApi, iccPatientApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHcpartyXApi } from "./icc-hcparty-x-api"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { DocumentDto, ListOfIdsDto } from "../icc-api/model/models"

// noinspection JSUnusedGlobalSymbols
export class IccPatientXApi extends iccPatientApi {
  crypto: IccCryptoXApi
  contactApi: IccContactXApi
  helementApi: iccHelementApi
  invoiceApi: iccInvoiceApi
  hcpartyApi: IccHcpartyXApi
  documentApi: iccDocumentApi

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    crypto: IccCryptoXApi,
    contactApi: IccContactXApi,
    helementApi: iccHelementApi,
    invoiceApi: iccInvoiceApi,
    documentApi: iccDocumentApi,
    hcpartyApi: IccHcpartyXApi
  ) {
    super(host, headers)
    this.crypto = crypto
    this.contactApi = contactApi
    this.helementApi = helementApi
    this.invoiceApi = invoiceApi
    this.hcpartyApi = hcpartyApi
    this.documentApi = documentApi
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
                this.crypto.appendObjectDelegations(
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
  }

  findByAccessLogUserAfterDate_1(externalId: string): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  findByAccessLogUserAfterDate_1WithUser(
    user: models.UserDto,
    externalId: string
  ): Promise<models.PatientDto | any> {
    return super.findByAccessLogUserAfterDate_1(externalId).then(pats => this.decrypt(user, pats))
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
  }

  listDeletedPatients_2(firstName?: string, lastName?: string): never {
    throw new Error(
      "Cannot call a method that returns contacts without providing a user for de/encryption"
    )
  }

  listDeletedPatients_2WithUser(
    user: models.UserDto,
    firstName?: string,
    lastName?: string
  ): Promise<Array<models.PatientPaginatedList> | any> {
    return super
      .listDeletedPatients_2(firstName, lastName)
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
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
    return super.listOfMergesAfter(date).then(pats => this.decrypt(user, pats))
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
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
      .then(pl => this.decrypt(user, pl.rows).then(dr => Object.assign(pl, { rows: dr })))
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

  encrypt(user: models.UserDto, pats: Array<models.PatientDto>) {
    return Promise.resolve(pats)
  }

  decrypt(user: models.UserDto, pats: Array<models.PatientDto>) {
    //First check that we have no dangling delegation
    const patsWithMissingDelegations = pats.filter(
      p =>
        p.delegations &&
        p.delegations[user.healthcarePartyId!] &&
        !p.delegations[user.healthcarePartyId!].length
    )

    let prom: Promise<{ [key: string]: models.PatientDto }> = Promise.resolve({})
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

    return prom.then((acc: { [key: string]: models.PatientDto }) =>
      pats.map(p => {
        const fixed = acc[p.id!]
        return fixed || p
      })
    )
  }

  share(
    user: models.UserDto,
    patId: string,
    ownerId: string,
    delegateIds: Array<string>
  ): Promise<models.PatientDto | null> {
    return this.getPatientWithUser(user, patId).then((p: models.PatientDto) => {
      const psfksPromise =
        p.delegations && p.delegations[ownerId] && p.delegations[ownerId].length
          ? this.crypto.extractDelegationsSFKs(p, ownerId).then(xks => xks.extractedKeys)
          : Promise.resolve([])
      const peksPromise =
        p.encryptionKeys && p.encryptionKeys[ownerId] && p.encryptionKeys[ownerId].length
          ? this.crypto.extractEncryptionsSKs(p, ownerId).then(xks => xks.extractedKeys)
          : Promise.resolve([])

      return Promise.all([psfksPromise, peksPromise]).then(
        ([psfks, peks]) =>
          psfks.length
            ? Promise.all([
                this.helementApi.findDelegationsStubsByHCPartyPatientSecretFKeys(
                  ownerId,
                  psfks.join(",")
                ) as Promise<Array<models.IcureStubDto>>,
                this.contactApi.findBy(ownerId, p) as Promise<Array<models.ContactDto>>,
                this.invoiceApi.findDelegationsStubsByHCPartyPatientSecretFKeys(
                  ownerId,
                  psfks.join(",")
                ) as Promise<Array<models.IcureStubDto>>
              ]).then(([hes, ctcs, ivs]) => {
                const ctcsStubs = ctcs.map(c => ({
                  id: c.id,
                  rev: c.rev,
                  delegations: c.delegations,
                  cryptedForeignKeys: c.cryptedForeignKeys,
                  encryptionKeys: c.encryptionKeys
                }))
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

                return this.documentApi
                  .getDocuments(new ListOfIdsDto({ ids: Object.keys(docIds) }))
                  .then(docs => {
                    let markerPromise: Promise<any> = Promise.resolve(null)
                    delegateIds.forEach(delegateId => {
                      markerPromise = markerPromise.then(() => {
                        console.log(`share ${p.id} to ${delegateId}`)
                        return this.crypto
                          .addDelegationsAndEncryptionKeys(
                            null,
                            p,
                            ownerId,
                            delegateId,
                            psfks[0],
                            peks[0]
                          )
                          .catch(e => {
                            console.log(e)
                            return p
                          })
                      })
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
                                  p,
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
                      )
                      ctcsStubs.forEach(
                        x =>
                          (markerPromise = markerPromise.then(() =>
                            Promise.all([
                              this.crypto.extractDelegationsSFKs(x, ownerId),
                              this.crypto.extractEncryptionsSKs(x, ownerId)
                            ]).then(([sfks, eks]) => {
                              console.log(`share ${p.id} to ${delegateId}`)
                              return this.crypto
                                .addDelegationsAndEncryptionKeys(
                                  p,
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
                      )
                      ivs.forEach(
                        x =>
                          (markerPromise = markerPromise.then(() =>
                            Promise.all([
                              this.crypto.extractDelegationsSFKs(x, ownerId),
                              this.crypto.extractEncryptionsSKs(x, ownerId)
                            ]).then(([sfks, eks]) => {
                              console.log(`share ${p.id} to ${delegateId}`)
                              return this.crypto
                                .addDelegationsAndEncryptionKeys(
                                  p,
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
                      )
                      docs.forEach(
                        (x: DocumentDto) =>
                          (markerPromise = markerPromise.then(() =>
                            Promise.all([
                              this.crypto.extractDelegationsSFKs(x, ownerId),
                              this.crypto.extractEncryptionsSKs(x, ownerId)
                            ]).then(([sfks, eks]) => {
                              console.log(`share ${p.id} to ${delegateId}`)
                              return this.crypto
                                .addDelegationsAndEncryptionKeys(
                                  p,
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
                      )
                    })
                    return markerPromise
                      .then(() => {
                        console.log("scd")
                        return this.contactApi.setContactsDelegations(ctcsStubs)
                      })
                      .then(() => {
                        console.log("shed")
                        return this.helementApi.setHealthElementsDelegations(hes)
                      })
                      .then(() => {
                        console.log("sid")
                        return this.invoiceApi.setInvoicesDelegations(ivs)
                      })
                      .then(() => {
                        console.log("sdd")
                        return this.documentApi.setDocumentsDelegations(docs)
                      })
                      .then(() => this.modifyPatientWithUser(user, p))
                  })
              })
            : this.modifyPatientWithUser(
                user,
                Object.assign(p, {
                  delegations: delegateIds
                    .filter(id => !p.delegations || !p.delegations[id])
                    .reduce(
                      (acc, del: String) => Object.assign(acc, _.fromPairs([[del, []]])),
                      p.delegations || {}
                    )
                })
              )
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
