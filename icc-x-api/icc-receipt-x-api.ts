import { iccReceiptApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { utils } from "./crypto/utils"

import * as _ from "lodash"
import * as models from "../icc-api/model/models"
import { XHR } from "../icc-api/api/XHR"
import {
  AgreementResponse,
  DmgAcknowledge,
  DmgConsultation,
  DmgNotification,
  DmgRegistration,
  InsurabilityInfoDto,
  TarificationConsultationResult
} from "fhc-api/dist/model/models"

export class IccReceiptXApi extends iccReceiptApi {
  crypto: IccCryptoXApi

  constructor(host: string, headers: Array<XHR.Header>, crypto: IccCryptoXApi) {
    super(host, headers)
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
          responsible: user.healthcarePartyId,
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
      this.crypto.initObjectDelegations(receipt, null, user.healthcarePartyId!, null),
      this.crypto.initEncryptionKeys(receipt, user.healthcarePartyId!)
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
            this.crypto.addDelegationsAndEncryptionKeys(
              null,
              receipt,
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

  initEncryptionKeys(user: models.UserDto, rcpt: models.ReceiptDto) {
    return this.crypto.initEncryptionKeys(rcpt, user.healthcarePartyId!).then(eks => {
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
              .appendEncryptionKeys(receipt, user.healthcarePartyId!, eks.secretId)
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
      .then(rcpt => this.setAttachment(rcpt.id, blobType, undefined, blob))
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
    refs: Array<string> = []
  ) {
    return this.newInstance(user, {
      documentId: docId,
      references: refs.concat(
        object.commonOutput
          ? _.compact([
              object.commonOutput.inputReference &&
                `mycarenet:efact:inputReference:${object.commonOutput.inputReference}`,
              object.commonOutput.inputReference &&
                `mycarenet:efact:outputReference:${object.commonOutput.outputReference}`,
              object.commonOutput.inputReference &&
                `mycarenet:efact:nipReference:${object.commonOutput.nipReference}`
            ])
          : []
      )
    })
      .then(rcpt => this.createReceipt(rcpt))
      .then(rcpt =>
        this.setAttachment(
          rcpt.id,
          "soapConversation",
          undefined,
          utils.ua2ArrayBuffer(utils.text2ua(JSON.stringify(object.mycarenetConversation)))
        )
      )
  }
}
