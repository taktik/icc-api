import { iccDoctemplateApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import { TextDecoder, TextEncoder } from "text-encoding"

import { extend } from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { DocumentTemplateDto } from "../icc-api/model/models"

// noinspection JSUnusedGlobalSymbols
export class IccDoctemplateXApi extends iccDoctemplateApi {
  crypto: IccCryptoXApi

  constructor(host: string, headers: { [key: string]: string }, crypto: IccCryptoXApi) {
    super(host, headers)
    this.crypto = crypto
  }

  newInstance(user: models.UserDto, template: string, c: any): Promise<DocumentTemplateDto> {
    return new Promise<DocumentTemplateDto>((resolve, reject) => {
      const documentTemplate: DocumentTemplateDto = extend(
        {
          id: this.crypto.randomUuid(),
          _type: "org.taktik.icure.entities.DocumentTemplate",
          owner: user.id,
          created: new Date().getTime(),
          modified: new Date().getTime(),
          guid: this.crypto.randomUuid(),
          group: null,
          specialty: null,
          attachment: this.crypto.utils.text2ua(template),
          mainUti: "public.plain-text"
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
  findAllByOwnerId(ownerId: string): Promise<Array<models.DocumentTemplateDto>> {
    return new Promise(function(resolve, reject) {
      reject(console.log("findByHCPartyPatientSecretFKeys not implemented in document API!"))
    })
  }

  // noinspection JSUnusedGlobalSymbols
  getAttachmentUrl(documentId: string, attachmentId: string) {
    return (
      this.host +
      "/doctemplate/{documentId}/attachment/{attachmentId}"
        .replace("{documentId}", documentId)
        .replace("{attachmentId}", attachmentId)
    )
  }

  getAttachmentText(documentTemplateId: string, attachmentId: string): Promise<any | Boolean> {
    const _body = null

    const _url =
      this.host +
      "/doctemplate/{documentTemplateId}/attachmentText/{attachmentId}"
        .replace("{documentTemplateId}", documentTemplateId + "")
        .replace("{attachmentId}", attachmentId + "") +
      "?ts=" +
      new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => {
        if (doc.contentType.startsWith("application/octet-stream")) {
          const enc = new TextDecoder("utf-8")
          const arr = new Uint8Array(doc.body)
          return enc.decode(arr)
        } else if (
          doc.contentType.startsWith("text/plain") ||
          doc.contentType.startsWith("text/html")
        ) {
          return doc.body
        } else {
          return false
        }
      })
      .catch(err => this.handleError(err))
  }
}
