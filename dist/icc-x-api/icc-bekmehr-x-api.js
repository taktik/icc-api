"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
class IccBekmehrXApi extends iccApi_1.iccBeKmehrApi {
  constructor(
    host,
    headers,
    ctcApi,
    helementApi,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.ctcApi = ctcApi
    this.helementApi = helementApi
    const auth = this.headers.find(h => h.header === "Authorization")
    this.wssHost = new URL(this.host, window.location.href).href
      .replace(/^http/, "ws")
      .replace(/\/rest\/v.+/, "/ws")
  }
  socketEventListener(socket, healthcarePartyId, resolve, reject, progressCallback) {
    const that = this
    return event => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data)
        if (msg.command === "decrypt") {
          if (msg.type === "ContactDto") {
            that.ctcApi
              .decrypt(healthcarePartyId, msg.body)
              .then(res =>
                socket.send(
                  JSON.stringify({ command: "decryptResponse", uuid: msg.uuid, body: res })
                )
              )
          } else if (msg.type === "HealthElementDto") {
            that.helementApi
              .decrypt(healthcarePartyId, msg.body)
              .then(res =>
                socket.send(
                  JSON.stringify({ command: "decryptResponse", uuid: msg.uuid, body: res })
                )
              )
          } else {
            that.ctcApi
              .decryptServices(healthcarePartyId, msg.body)
              .then(res =>
                socket.send(
                  JSON.stringify({ command: "decryptResponse", uuid: msg.uuid, body: res })
                )
              )
          }
        } else if ((msg.command = "progress")) {
          if (progressCallback && msg.body && msg.body[0]) {
            progressCallback(msg.body[0].progress)
          }
        }
      } else {
        resolve(event.data)
        socket.close(1000, "Ok")
      }
    }
  }
  generateSmfExportWithEncryptionSupport(
    patientId,
    healthcarePartyId,
    language,
    body,
    progressCallback,
    sessionId
  ) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `${this.wssHost}/be_kmehr/generateSmf${sessionId ? `;jsessionid=${sessionId}` : ""}`
      )
      socket.addEventListener("open", function() {
        socket.send(
          JSON.stringify({ parameters: { patientId: patientId, language: language, info: body } })
        )
      })
      // Listen for messages
      socket.addEventListener(
        "message",
        this.socketEventListener(socket, healthcarePartyId, resolve, reject, progressCallback)
      )
    })
  }
  generateSumehrExportWithEncryptionSupport(
    patientId,
    healthcarePartyId,
    language,
    body,
    sessionId
  ) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `${this.wssHost}/be_kmehr/generateSumehr${sessionId ? `;jsessionid=${sessionId}` : ""}`
      )
      socket.addEventListener("open", function() {
        socket.send(
          JSON.stringify({ parameters: { patientId: patientId, language: language, info: body } })
        )
      })
      // Listen for messages
      socket.addEventListener(
        "message",
        this.socketEventListener(socket, healthcarePartyId, resolve, reject)
      )
    })
  }
  generateSumehrV2ExportWithEncryptionSupport(
    patientId,
    healthcarePartyId,
    language,
    body,
    sessionId
  ) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `${this.wssHost}/be_kmehr/generateSumehrV2${sessionId ? `;jsessionid=${sessionId}` : ""}`
      )
      socket.addEventListener("open", function() {
        socket.send(
          JSON.stringify({ parameters: { patientId: patientId, language: language, info: body } })
        )
      })
      // Listen for messages
      socket.addEventListener(
        "message",
        this.socketEventListener(socket, healthcarePartyId, resolve, reject)
      )
    })
  }
  generateDiaryNoteExportWithEncryptionSupport(
    patientId,
    healthcarePartyId,
    language,
    body,
    sessionId
  ) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `${this.wssHost}/be_kmehr/generateDiaryNote${sessionId ? `;jsessionid=${sessionId}` : ""}`
      )
      socket.addEventListener("open", function() {
        socket.send(
          JSON.stringify({ parameters: { patientId: patientId, language: language, info: body } })
        )
      })
      // Listen for messages
      socket.addEventListener(
        "message",
        this.socketEventListener(socket, healthcarePartyId, resolve, reject)
      )
    })
  }
  generateMedicationSchemeWithEncryptionSupport(
    patientId,
    healthcarePartyId,
    language,
    version,
    body,
    sessionId
  ) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `${this.wssHost}/be_kmehr/generateMedicationScheme${
          sessionId ? `;jsessionid=${sessionId}` : ""
        }`
      )
      socket.addEventListener("open", function() {
        socket.send(
          JSON.stringify({
            parameters: { patientId: patientId, language: language, version: version, info: body }
          })
        )
      })
      // Listen for messages
      socket.addEventListener(
        "message",
        this.socketEventListener(socket, healthcarePartyId, resolve, reject)
      )
    })
  }
}
exports.IccBekmehrXApi = IccBekmehrXApi
//# sourceMappingURL=icc-bekmehr-x-api.js.map
