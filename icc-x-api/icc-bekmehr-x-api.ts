import * as models from "../icc-api/model/models"
import { iccAuthApi, iccBekmehrApi } from "../icc-api/iccApi"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHelementXApi } from "./icc-helement-x-api"
import { utils } from "./crypto/utils"
import { IccDocumentXApi } from "./icc-document-x-api"
import { DocumentDto } from "../icc-api/model/models"

export class IccBekmehrXApi extends iccBekmehrApi {
  private readonly ctcApi: IccContactXApi
  private readonly helementApi: IccHelementXApi
  private readonly documentApi: IccDocumentXApi
  private readonly wssHost: string
  private readonly authApi: iccAuthApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    authApi: iccAuthApi,
    ctcApi: IccContactXApi,
    helementApi: IccHelementXApi,
    documentApi: IccDocumentXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.authApi = authApi
    this.ctcApi = ctcApi
    this.helementApi = helementApi
    this.documentApi = documentApi

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
      socket.send(data.length > 65000 ? utils.text2ua(data).buffer : data)
    }

    const messageHandler = (msg: any) => {
      if (msg.command === "decrypt") {
        if (msg.type === "ContactDto") {
          that.ctcApi
            .decrypt(healthcarePartyId, msg.body)
            .then((res) => send("decryptResponse", msg.uuid, res))
        } else if (msg.type === "HealthElementDto") {
          that.helementApi
            .decrypt(healthcarePartyId, msg.body)
            .then((res) => send("decryptResponse", msg.uuid, res))
        } else if (msg.type === "DocumentDto") {
          that.documentApi
            .decrypt(
              healthcarePartyId,
              msg.body.map((d: JSON) => new DocumentDto(d))
            )
            .then((res) =>
              send(
                "decryptResponse",
                msg.uuid,
                res?.map((d) => {
                  const { encryptedAttachment, ...stripped } = d
                  return stripped
                })
              )
            )
        } else {
          that.ctcApi
            .decryptServices(healthcarePartyId, msg.body)
            .then((res) => send("decryptResponse", msg.uuid, res))
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
        br.onload = function (e) {
          const firstChar = e.target && new Uint8Array((e.target as any).result as ArrayBuffer)[0]

          if (firstChar === 0x7b) {
            const tr = new FileReader()
            tr.onload = function (e) {
              const msg = e.target && JSON.parse((e.target as any).result as string)
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
  ): Promise<Blob | undefined> {
    return (
      !sessionId ? this.authApi.token("GET", "/ws/be_kmehr/generateSmf") : Promise.resolve("")
    ).then(
      (token) =>
        new Promise<Blob | undefined>((resolve, reject) => {
          const socket = new WebSocket(
            token.length
              ? `${this.wssHost}/be_kmehr/generateSmf;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateSmf;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function () {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body },
              })
            )
          })

          // Listen for messages
          socket.addEventListener(
            "message",
            this.socketEventListener(socket, healthcarePartyId, resolve, reject, progressCallback)
          )
        })
    )
  }

  generateSumehrExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob | undefined> {
    return (
      !sessionId ? this.authApi.token("GET", "/ws/be_kmehr/generateSumehr") : Promise.resolve("")
    ).then(
      (token) =>
        new Promise<Blob | undefined>((resolve, reject) => {
          const socket = new WebSocket(
            token.length
              ? `${this.wssHost}/be_kmehr/generateSumehr;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateSumehr;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function () {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body },
              })
            )
          })
          // Listen for messages
          socket.addEventListener(
            "message",
            this.socketEventListener(socket, healthcarePartyId, resolve, reject)
          )
        })
    )
  }

  generateSumehrV2ExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob | undefined> {
    return (
      !sessionId ? this.authApi.token("GET", "/ws/be_kmehr/generateSumehrV2") : Promise.resolve("")
    ).then(
      (token) =>
        new Promise<Blob | undefined>((resolve, reject) => {
          const socket = new WebSocket(
            token.length
              ? `${this.wssHost}/be_kmehr/generateSumehrV2;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateSumehrV2;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function () {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body },
              })
            )
          })
          // Listen for messages
          socket.addEventListener(
            "message",
            this.socketEventListener(socket, healthcarePartyId, resolve, reject)
          )
        })
    )
  }

  generateDiaryNoteExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob | undefined> {
    return (
      !sessionId ? this.authApi.token("GET", "/ws/be_kmehr/generateDiaryNote") : Promise.resolve("")
    ).then(
      (token) =>
        new Promise<Blob | undefined>((resolve, reject) => {
          const socket = new WebSocket(
            token.length
              ? `${this.wssHost}/be_kmehr/generateDiaryNote;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateDiaryNote;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function () {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body },
              })
            )
          })
          // Listen for messages
          socket.addEventListener(
            "message",
            this.socketEventListener(socket, healthcarePartyId, resolve, reject)
          )
        })
    )
  }

  generateMedicationSchemeWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    recipientSafe: string,
    version: number,
    body: models.MedicationSchemeExportInfoDto,
    sessionId?: string
  ): Promise<Blob | undefined> {
    return (
      !sessionId
        ? this.authApi.token("GET", "/ws/be_kmehr/generateMedicationScheme")
        : Promise.resolve("")
    ).then(
      (token) =>
        new Promise<Blob | undefined>((resolve, reject) => {
          const socket = new WebSocket(
            token.length
              ? `${this.wssHost}/be_kmehr/generateMedicationScheme;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateMedicationScheme;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function () {
            socket.send(
              JSON.stringify({
                parameters: {
                  patientId: patientId,
                  language: language,
                  recipientSafe: recipientSafe,
                  version: version,
                  info: body,
                },
              })
            )
          })
          // Listen for messages
          socket.addEventListener(
            "message",
            this.socketEventListener(socket, healthcarePartyId, resolve, reject)
          )
        })
    )
  }
}
