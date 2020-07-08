import { iccReceiptApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { utils } from "./crypto/utils"
import * as moment from "moment"
import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import {
  AgreementResponse,
  DmgAcknowledge,
  DmgConsultation,
  DmgNotification,
  DmgRegistration,
  InsurabilityInfoDto,
  TarificationConsultationResult
} from "fhc-api"

export class IccReceiptXApi extends iccReceiptApi {
  crypto: IccCryptoXApi

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

  newInstance(user: models.UserDto, r: any): Promise<models.ReceiptDto> {
    const receipt = new models.ReceiptDto(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          _type: "org.taktik.icure.entities.Receipt",
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: user.healthcarePartyId || user.patientId,
          author: user.id,
          codes: [],
          tags: []
        },
        r || {}
      )
    )

    return this.initDelegationsAndEncryptionKeys(user, receipt)
  }

  private initDelegationsAndEncryptionKeys(
    user: models.UserDto,
    receipt: models.ReceiptDto
  ): Promise<models.ReceiptDto> {
    return Promise.all([
      this.crypto.initObjectDelegations(
        receipt,
        null,
        (user.healthcarePartyId || user.patientId)!,
        null
      ),
      this.crypto.initEncryptionKeys(receipt, (user.healthcarePartyId || user.patientId)!)
    ]).then(initData => {
      const dels = initData[0]
      const eks = initData[1]
      _.extend(receipt, {
        delegations: dels.delegations,
        cryptedForeignKeys: dels.cryptedForeignKeys,
        secretForeignKeys: dels.secretForeignKeys,
        encryptionKeys: eks.encryptionKeys
      })

      let promise = Promise.resolve(receipt)
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        delegateId =>
          (promise = promise.then(receipt =>
            this.crypto
              .addDelegationsAndEncryptionKeys(
                null,
                receipt,
                (user.healthcarePartyId || user.patientId)!,
                delegateId,
                dels.secretId,
                eks.secretId
              )
              .catch(e => {
                console.log(e)
                return receipt
              })
          ))
      )
      return promise
    })
  }

  initEncryptionKeys(user: models.UserDto, rcpt: models.ReceiptDto) {
    return this.crypto
      .initEncryptionKeys(rcpt, (user.healthcarePartyId || user.patientId)!)
      .then(eks => {
        let promise = Promise.resolve(
          _.extend(rcpt, {
            encryptionKeys: eks.encryptionKeys
          })
        )
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          delegateId =>
            (promise = promise.then(receipt =>
              this.crypto
                .appendEncryptionKeys(
                  receipt,
                  (user.healthcarePartyId || user.patientId)!,
                  delegateId,
                  eks.secretId
                )
                .then(extraEks => {
                  return _.extend(receipt, {
                    encryptionKeys: extraEks.encryptionKeys
                  })
                })
            ))
        )
        return promise
      })
  }

  logReceipt(
    user: models.UserDto,
    docId: string,
    refs: Array<string>,
    blobType: string,
    blob: ArrayBuffer
  ) {
    return this.newInstance(user, { documentId: docId, references: refs })
      .then(rcpt => this.createReceipt(rcpt))
      .then(rcpt => this.setReceiptAttachment(rcpt.id, blobType, "", <any>blob))
  }

  logSCReceipt(
    object:
      | AgreementResponse
      | DmgConsultation
      | DmgAcknowledge
      | DmgConsultation
      | DmgNotification
      | DmgRegistration
      | TarificationConsultationResult
      | InsurabilityInfoDto,
    user: models.UserDto,
    docId: string,
    cat: string,
    subcat: string,
    refs: Array<string> = []
  ) {
    return this.newInstance(user, {
      category: cat,
      subCategory: subcat,
      documentId: docId,
      references: refs.concat(
        object.commonOutput
          ? _.compact([
              object.commonOutput.inputReference &&
                `mycarenet:${cat}:inputReference:${object.commonOutput.inputReference}`,
              object.commonOutput.inputReference &&
                `mycarenet:${cat}:outputReference:${object.commonOutput.outputReference}`,
              object.commonOutput.inputReference &&
                `mycarenet:${cat}:nipReference:${object.commonOutput.nipReference}`
            ])
          : [],
        ["date:" + moment().format("YYYYMMDDHHmmss")]
      )
    })
      .then(rcpt => this.createReceipt(rcpt))
      .then(rcpt =>
        this.setReceiptAttachment(rcpt.id, "soapConversation", "", <any>(
          utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(object.mycarenetConversation)))
        ))
      )
  }
}
