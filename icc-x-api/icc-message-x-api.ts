import { IccEntityrefApi, IccInsuranceApi, IccMessageApi } from "../icc-api"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { IccDocumentXApi } from "./icc-document-x-api"
import { IccInvoiceXApi } from "./icc-invoice-x-api"

import * as _ from "lodash"
import * as moment from "moment"

import {
  AbstractFilterPatient,
  EntityReference,
  FilterChainPatient,
  HealthcareParty,
  Insurance,
  Invoice,
  ListOfIds,
  Message,
  PaginatedListPatient,
  Patient,
  PatientHealthCareParty,
  Receipt,
  ReferralPeriod,
  User
} from "../icc-api/model/models"

import { timeEncode } from "./utils/formatting-util"
import { fhcEfactControllerApi, EfactSendResponse } from "fhc-api"
import { utils } from "./crypto/utils"
import { IccReceiptXApi } from "./icc-receipt-x-api"
import { IccPatientXApi } from "./icc-patient-x-api"

export class IccMessageXApi extends IccMessageApi {
  private crypto: IccCryptoXApi
  private insuranceApi: IccInsuranceApi
  private entityReferenceApi: IccEntityrefApi
  private receiptXApi: IccReceiptXApi
  private invoiceXApi: IccInvoiceXApi
  private documentXApi: IccDocumentXApi
  private patientApi: IccPatientXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    insuranceApi: IccInsuranceApi,
    entityReferenceApi: IccEntityrefApi,
    invoiceXApi: IccInvoiceXApi,
    documentXApi: IccDocumentXApi,
    receiptXApi: IccReceiptXApi,
    patientApi: IccPatientXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.insuranceApi = insuranceApi
    this.entityReferenceApi = entityReferenceApi
    this.receiptXApi = receiptXApi
    this.invoiceXApi = invoiceXApi
    this.documentXApi = documentXApi
    this.patientApi = patientApi
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: User, m: any) {
    return this.newInstanceWithPatient(user, null, m)
  }

  newInstanceWithPatient(user: User, patient: Patient | null, m: any) {
    const message = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: "org.taktik.icure.entities.Message",
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: []
      },
      m || {}
    )

    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId)
      .then(secretForeignKeys =>
        this.crypto.initObjectDelegations(
          message,
          patient,
          hcpId!,
          secretForeignKeys.extractedKeys[0]
        )
      )
      .then(initData => {
        _.extend(message, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys
        })

        let promise = Promise.resolve(message)
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(helement =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(
                  helement,
                  patient,
                  hcpId!,
                  delegateId,
                  initData.secretId
                )
                .then(extraData =>
                  _.extend(helement, {
                    delegations: extraData.delegations,
                    cryptedForeignKeys: extraData.cryptedForeignKeys
                  })
                )
                .catch(e => {
                  console.log(e)
                  return helement
                })
            ))
        )
        return promise
      })
  }
}
