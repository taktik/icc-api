import { iccBeKmehrApi } from "../icc-api/iccApi"

import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHelementXApi } from "./icc-helement-x-api"
import { utils } from "./crypto/utils"

export class IccBekmehrXApi extends iccBeKmehrApi {
  private readonly ctcApi: IccContactXApi
  private readonly helementApi: IccHelementXApi
  private readonly wssHost: string
  private preferBinaryForLargeMessages: boolean

  constructor(
    host: string,
    headers: { [key: string]: string },
    ctcApi: IccContactXApi,
    helementApi: IccHelementXApi,
    preferBinaryForLargeMessages: boolean = false,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : (self.fetch as any)
  ) {
    super(host, headers, fetchImpl)
    this.ctcApi = ctcApi
    this.helementApi = helementApi
    this.preferBinaryForLargeMessages = preferBinaryForLargeMessages

    const auth = this.headers.find(h => h.header === "Authorization")
    this.wssHost = new URL(this.host, window.location.href).href
      .replace(/^http/, "ws")
      .replace(/\/rest\/v.+/, "/ws")
  }

  socketEventListener(
    socket: WebSocket,
    healthcarePartyId: string,
    resolve: (value?: Blob) => void,
    reject: (reason?: any) => void,
    progressCallback?: (progress: number) => void
  ) {
    const that = this

    const send = (command: string, uuid: string, body: any) => {
      const data = JSON.stringify({ command, uuid, body })
      socket.send(
        data.length > 65000 && this.preferBinaryForLargeMessages ? utils.text2ua(data).buffer : data
      )
    }

    const messageHandler = (msg: any) => {
      if (msg.command === "decrypt") {
        if (msg.type === "ContactDto") {
          that.ctcApi
            .decrypt(healthcarePartyId, msg.body)
            .then(res => send("decryptResponse", msg.uuid, res))
        } else if (msg.type === "HealthElementDto") {
          that.helementApi
            .decrypt(healthcarePartyId, msg.body)
            .then(res => send("decryptResponse", msg.uuid, res))
        } else {
          that.ctcApi
            .decryptServices(healthcarePartyId, msg.body)
            .then(res => send("decryptResponse", msg.uuid, res))
        }
      } else if ((msg.command = "progress")) {
        if (progressCallback && msg.body && msg.body[0]) {
          progressCallback(msg.body[0].progress)
        }
      }
    }

    return (event: MessageEvent) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data)
        messageHandler(msg)
      } else {
        const blob: Blob = event.data
        var subBlob = blob.slice(0, 1)
        const br = new FileReader()
        br.onload = function(e) {
          const firstChar = e.target && new Uint8Array(e.target.result as ArrayBuffer)[0]

          if (firstChar === 0x7b) {
            const tr = new FileReader()
            tr.onload = function(e) {
              const msg = e.target && JSON.parse(e.target.result as string)
              messageHandler(msg)
            }
            tr.readAsBinaryString(blob)
          } else {
            resolve(blob)
            socket.close(1000, "Ok")
          }
        }
        br.readAsArrayBuffer(subBlob)
      }
    }
  }

  generateSmfExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SoftwareMedicalFileExportDto,
    progressCallback?: (progress: number) => void,
    sessionId?: string
  ): Promise<Blob> {
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
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob> {
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
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob> {
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
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob> {
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
    patientId: string,
    healthcarePartyId: string,
    language: string,
    recipientSafe: string,
    version: number,
    body: models.MedicationSchemeExportInfoDto,
    sessionId?: string
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `${this.wssHost}/be_kmehr/generateMedicationScheme${
          sessionId ? `;jsessionid=${sessionId}` : ""
        }`
      )
      socket.addEventListener("open", function() {
        socket.send(
          JSON.stringify({
            parameters: {
              patientId: patientId,
              language: language,
              recipientSafe: recipientSafe,
              version: version,
              info: body
            }
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
