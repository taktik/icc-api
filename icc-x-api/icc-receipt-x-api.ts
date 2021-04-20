import { IccReceiptApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as _ from 'lodash'
import * as models from '../icc-api/model/models'

export class IccReceiptXApi extends IccReceiptApi {
  crypto: IccCryptoXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }

  newInstance(user: models.User, r: any): Promise<models.Receipt> {
    const receipt = new models.Receipt(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          _type: 'org.taktik.icure.entities.Receipt',
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: user.healthcarePartyId || user.patientId,
          author: user.id,
          codes: [],
          tags: [],
        },
        r || {}
      )
    )

    return this.initDelegationsAndEncryptionKeys(user, receipt)
  }

  private initDelegationsAndEncryptionKeys(
    user: models.User,
    receipt: models.Receipt
  ): Promise<models.Receipt> {
    return Promise.all([
      this.crypto.initObjectDelegations(
        receipt,
        null,
        (user.healthcarePartyId || user.patientId)!,
        null
      ),
      this.crypto.initEncryptionKeys(receipt, (user.healthcarePartyId || user.patientId)!),
    ]).then((initData) => {
      const dels = initData[0]
      const eks = initData[1]
      _.extend(receipt, {
        delegations: dels.delegations,
        cryptedForeignKeys: dels.cryptedForeignKeys,
        secretForeignKeys: dels.secretForeignKeys,
        encryptionKeys: eks.encryptionKeys,
      })

      let promise = Promise.resolve(receipt)
      ;(user.autoDelegations
        ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
        : []
      ).forEach(
        (delegateId) =>
          (promise = promise.then((receipt) =>
            this.crypto
              .addDelegationsAndEncryptionKeys(
                null,
                receipt,
                (user.healthcarePartyId || user.patientId)!,
                delegateId,
                dels.secretId,
                eks.secretId
              )
              .catch((e) => {
                console.log(e)
                return receipt
              })
          ))
      )
      return promise
    })
  }

  initEncryptionKeys(user: models.User, rcpt: models.Receipt) {
    return this.crypto
      .initEncryptionKeys(rcpt, (user.healthcarePartyId || user.patientId)!)
      .then((eks) => {
        let promise = Promise.resolve(
          _.extend(rcpt, {
            encryptionKeys: eks.encryptionKeys,
          })
        )
        ;(user.autoDelegations
          ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || [])
          : []
        ).forEach(
          (delegateId) =>
            (promise = promise.then((receipt) =>
              this.crypto
                .appendEncryptionKeys(
                  receipt,
                  (user.healthcarePartyId || user.patientId)!,
                  delegateId,
                  eks.secretId
                )
                .then((extraEks) => {
                  return _.extend(receipt, {
                    encryptionKeys: extraEks.encryptionKeys,
                  })
                })
            ))
        )
        return promise
      })
  }

  logReceipt(
    user: models.User,
    docId: string,
    refs: Array<string>,
    blobType: string,
    blob: ArrayBuffer
  ) {
    return this.newInstance(user, { documentId: docId, references: refs })
      .then((rcpt) => this.createReceipt(rcpt))
      .then((rcpt) => this.setReceiptAttachment(rcpt.id!, blobType, '', <any>blob))
  }
}
