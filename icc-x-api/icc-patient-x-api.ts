import { iccPatientApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHcpartyXApi } from "./icc-hcparty-x-api"
import { iccInvoiceApi } from "../icc-api/api/ICCInvoiceApi"
import { iccHelementApi } from "../icc-api/api/ICCHelementApi"
import { iccDocumentApi } from "../icc-api/api/ICCDocumentApi"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

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
    return this.initDelegations(patient, null, user)
  }

  initDelegations(
    patient: models.PatientDto,
    parentObject: any,
    user: models.UserDto,
    secretForeignKey?: string
  ): Promise<models.PatientDto> {
    return this.crypto
      .initObjectDelegations(
        patient,
        parentObject,
        user.healthcarePartyId!,
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
                this.crypto.appendObjectDelegations(
                  patient,
                  parentObject,
                  user.healthcarePartyId!,
                  delegateId,
                  initData.secretId
                )
              )
              .then(extraData => _.extend(patient, { delegations: extraData.delegations })))
        )
        return promise
      })
  }

  share(patId: string, ownerId: string, delegateIds: Array<string>): Promise<models.PatientDto> {
    return this.getPatient(patId).then((p: models.PatientDto) => {
      const psfksPromise =
        p.delegations && p.delegations[ownerId] && p.delegations[ownerId].length
          ? this.crypto.extractDelegationsSFKs(p, ownerId)
          : Promise.resolve([])
      const peksPromise =
        p.encryptionKeys && p.encryptionKeys[ownerId] && p.encryptionKeys[ownerId].length
          ? this.crypto.extractEncryptionsSKs(p, ownerId)
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

                return Promise.all(
                  Object.keys(docIds).map(dId => this.documentApi.getDocument(dId))
                ).then(docs => {
                  let markerPromise: Promise<any> = Promise.resolve(null)
                  delegateIds.forEach(delegateId => {
                    markerPromise = markerPromise.then(() =>
                      this.crypto.addDelegationsAndEncryptionKeys(
                        null,
                        p,
                        ownerId,
                        delegateId,
                        psfks[0],
                        peks[0]
                      )
                    )
                    hes.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) =>
                            this.crypto.addDelegationsAndEncryptionKeys(
                              p,
                              x,
                              ownerId,
                              delegateId,
                              sfks[0],
                              eks[0]
                            )
                          )
                        ))
                    )
                    ctcsStubs.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) =>
                            this.crypto.addDelegationsAndEncryptionKeys(
                              p,
                              x,
                              ownerId,
                              delegateId,
                              sfks[0],
                              eks[0]
                            )
                          )
                        ))
                    )
                    ivs.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) =>
                            this.crypto.addDelegationsAndEncryptionKeys(
                              p,
                              x,
                              ownerId,
                              delegateId,
                              sfks[0],
                              eks[0]
                            )
                          )
                        ))
                    )
                    docs.forEach(
                      x =>
                        (markerPromise = markerPromise.then(() =>
                          Promise.all([
                            this.crypto.extractDelegationsSFKs(x, ownerId),
                            this.crypto.extractEncryptionsSKs(x, ownerId)
                          ]).then(([sfks, eks]) =>
                            this.crypto.addDelegationsAndEncryptionKeys(
                              p,
                              x,
                              ownerId,
                              delegateId,
                              sfks[0],
                              eks[0]
                            )
                          )
                        ))
                    )
                  })
                  return markerPromise
                    .then(() => {
                      this.contactApi.setContactsDelegations(ctcsStubs)
                    })
                    .then(() => this.helementApi.setHealthElementsDelegations(hes))
                    .then(() => this.invoiceApi.setInvoicesDelegations(ivs))
                    .then(() => this.documentApi.setDocumentsDelegations(docs))
                    .then(() => this.modifyPatient(p))
                })
              })
            : this.modifyPatient(
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

  isValidSsin(ssin: string) {
    ssin = ssin.replace(new RegExp("[^(0-9)]", "g"), "")
    let isValidNiss = false

    const normalNumber = /^[0-9][0-9](([0][0-9])|([1][0-2]))(([0-2][0-9])|([3][0-1]))(([0-9]{2}[1-9])|([0-9][1-9][0-9])|([1-9][0-9]{2}))(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )
      ? true
      : false
    const bisNumber = /^[0-9][0-9](([2][0-9])|([3][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )
      ? true
      : false
    const terNumber = /^[0-9][0-9](([4][0-9])|([5][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(
      ssin
    )
      ? true
      : false

    if (normalNumber || bisNumber || terNumber) {
      isValidNiss =
        97 - (Number(ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
          ? true
          : 97 - (Number("2" + ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
            ? true
            : false
    }

    return isValidNiss
  }
}
