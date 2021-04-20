import { IccDoctemplateApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import { extend } from 'lodash'
import * as models from '../icc-api/model/models'
import { DocumentTemplate } from '../icc-api/model/models'
import { string2ua } from './utils/binary-utils'

// noinspection JSUnusedGlobalSymbols
export class IccDoctemplateXApi extends IccDoctemplateApi {
  crypto: IccCryptoXApi
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>

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
    this.fetchImpl = fetchImpl
  }

  newInstance(user: models.User, template: string, c: any): Promise<DocumentTemplate> {
    return new Promise<DocumentTemplate>((resolve, reject) => {
      const documentTemplate: DocumentTemplate = extend(
        {
          id: this.crypto.randomUuid(),
          _type: 'org.taktik.icure.entities.DocumentTemplate',
          owner: user.id,
          created: new Date().getTime(),
          modified: new Date().getTime(),
          guid: this.crypto.randomUuid(),
          group: null,
          specialty: null,
          attachment: string2ua(template),
          mainUti: 'public.plain-text',
        },
        c || {}
      )
      if (documentTemplate.group && documentTemplate.group.guid == null) {
        documentTemplate.group.guid = this.crypto.randomUuid()
      }

      //sauver l doctemplate vide

      if (template) {
        //save attachement
      }

      return resolve(documentTemplate)
    })
  }

  // noinspection JSUnusedLocalSymbols
  findAllByOwnerId(ownerId: string): Promise<Array<models.DocumentTemplate>> {
    return new Promise(function (resolve, reject) {
      reject(console.log('findByHCPartyPatientSecretFKeys not implemented in document API!'))
    })
  }

  // noinspection JSUnusedGlobalSymbols
  getAttachmentUrl(documentId: string, attachmentId: string) {
    return (
      this.host +
      '/doctemplate/{documentId}/attachment/{attachmentId}'
        .replace('{documentId}', documentId)
        .replace('{attachmentId}', attachmentId)
    )
  }
}
