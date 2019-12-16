"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const text_encoding_1 = require("text-encoding")
const lodash_1 = require("lodash")
const XHR_1 = require("../icc-api/api/XHR")
// noinspection JSUnusedGlobalSymbols
class IccDoctemplateXApi extends iccApi_1.iccDoctemplateApi {
  constructor(
    host,
    headers,
    crypto,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.fetchImpl = fetchImpl
  }
  newInstance(user, template, c) {
    return new Promise((resolve, reject) => {
      const documentTemplate = lodash_1.extend(
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
  findAllByOwnerId(ownerId) {
    return new Promise(function(resolve, reject) {
      reject(console.log("findByHCPartyPatientSecretFKeys not implemented in document API!"))
    })
  }
  // noinspection JSUnusedGlobalSymbols
  getAttachmentUrl(documentId, attachmentId) {
    return (
      this.host +
      "/doctemplate/{documentId}/attachment/{attachmentId}"
        .replace("{documentId}", documentId)
        .replace("{attachmentId}", attachmentId)
    )
  }
  getAttachmentText(documentTemplateId, attachmentId) {
    const _body = null
    const _url =
      this.host +
      "/doctemplate/{documentTemplateId}/attachmentText/{attachmentId}"
        .replace("{documentTemplateId}", documentTemplateId + "")
        .replace("{attachmentId}", attachmentId + "") +
      "?ts=" +
      new Date().getTime()
    return XHR_1.XHR.sendCommand("GET", _url, this.headers, _body, this.fetchImpl)
      .then(doc => {
        if (doc.contentType.startsWith("application/octet-stream")) {
          const enc = new text_encoding_1.TextDecoder("utf-8")
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
exports.IccDoctemplateXApi = IccDoctemplateXApi
//# sourceMappingURL=icc-doctemplate-x-api.js.map
