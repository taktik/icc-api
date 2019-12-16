"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const utils_1 = require("./crypto/utils")
const moment = require("moment")
const _ = require("lodash")
const models = require("../icc-api/model/models")
class IccReceiptXApi extends iccApi_1.iccReceiptApi {
  constructor(
    host,
    headers,
    crypto,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }
  newInstance(user, r) {
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
  initDelegationsAndEncryptionKeys(user, receipt) {
    return Promise.all([
      this.crypto.initObjectDelegations(
        receipt,
        null,
        user.healthcarePartyId || user.patientId,
        null
      ),
      this.crypto.initEncryptionKeys(receipt, user.healthcarePartyId || user.patientId)
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
                user.healthcarePartyId || user.patientId,
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
  initEncryptionKeys(user, rcpt) {
    return this.crypto
      .initEncryptionKeys(rcpt, user.healthcarePartyId || user.patientId)
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
                  user.healthcarePartyId || user.patientId,
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
  logReceipt(user, docId, refs, blobType, blob) {
    return this.newInstance(user, { documentId: docId, references: refs })
      .then(rcpt => this.createReceipt(rcpt))
      .then(rcpt => this.setAttachment(rcpt.id, blobType, undefined, blob))
  }
  logSCReceipt(object, user, docId, cat, subcat, refs = []) {
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
        this.setAttachment(
          rcpt.id,
          "soapConversation",
          undefined,
          utils_1.utils.ua2ArrayBuffer(
            utils_1.utils.text2ua(JSON.stringify(object.mycarenetConversation))
          )
        )
      )
  }
}
exports.IccReceiptXApi = IccReceiptXApi
//# sourceMappingURL=icc-receipt-x-api.js.map
