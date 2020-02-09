import * as models from "../icc-api/model/models"
import { iccAuthApi, iccBeKmehrApi } from "../icc-api/iccApi"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHelementXApi } from "./icc-helement-x-api"

export class IccBekmehrXApi extends iccBeKmehrApi {
  private readonly ctcApi: IccContactXApi
  private readonly helementApi: IccHelementXApi
  private readonly wssHost: string
  private readonly authApi: iccAuthApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    authApi: iccAuthApi,
    ctcApi: IccContactXApi,
    helementApi: IccHelementXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : (self.fetch as any)
  ) {
    super(host, headers, fetchImpl)
    this.authApi = authApi
    this.ctcApi = ctcApi
    this.helementApi = helementApi

    const auth = this.headers.find(h => h.header === "Authorization")
    this.wssHost = new URL(this.host, window.location.href).href
      .replace(/^http/, "ws")
      .replace(/\/rest\/v.+/, "/ws")
  }

  socketEventListener(
    socket: WebSocket,
    healthcarePartyId: string,
    resolve: (value?: Promise<Blob>) => void,
    reject: (reason?: any) => void,
    progressCallback?: (progress: number) => void
  ) {
    const that = this
    return (event: MessageEvent) => {
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
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SoftwareMedicalFileExportDto,
    progressCallback?: (progress: number) => void,
    sessionId?: string
  ): Promise<Blob> {
    return (!sessionId
      ? this.authApi.token("GET", "/ws/be_kmehr/generateSmf")
      : Promise.resolve()
    ).then(
      token =>
        new Promise<Blob>((resolve, reject) => {
          const socket = new WebSocket(
            token
              ? `${this.wssHost}/be_kmehr/generateSmf;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateSmf;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function() {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body }
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
  ): Promise<Blob> {
    return (!sessionId
      ? this.authApi.token("GET", "/ws/be_kmehr/generateSumehr")
      : Promise.resolve()
    ).then(
      token =>
        new Promise<Blob>((resolve, reject) => {
          const socket = new WebSocket(
            token
              ? `${this.wssHost}/be_kmehr/generateSumehr;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateSumehr;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function() {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body }
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
  ): Promise<Blob> {
    return (!sessionId
      ? this.authApi.token("GET", "/ws/be_kmehr/generateSumehrV2")
      : Promise.resolve()
    ).then(
      token =>
        new Promise<Blob>((resolve, reject) => {
          const socket = new WebSocket(
            token
              ? `${this.wssHost}/be_kmehr/generateSumehrV2;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateSumehrV2;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function() {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body }
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
  ): Promise<Blob> {
    return (!sessionId
      ? this.authApi.token("GET", "/ws/be_kmehr/generateDiaryNote")
      : Promise.resolve()
    ).then(
      token =>
        new Promise<Blob>((resolve, reject) => {
          const socket = new WebSocket(
            token
              ? `${this.wssHost}/be_kmehr/generateDiaryNote;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateDiaryNote;sessionid=${sessionId}`
          )
          socket.addEventListener("open", function() {
            socket.send(
              JSON.stringify({
                parameters: { patientId: patientId, language: language, info: body }
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
  ): Promise<Blob> {
    return (!sessionId
      ? this.authApi.token("GET", "/ws/be_kmehr/generateMedicationScheme")
      : Promise.resolve()
    ).then(
      token =>
        new Promise<Blob>((resolve, reject) => {
          const socket = new WebSocket(
            token
              ? `${this.wssHost}/be_kmehr/generateMedicationScheme;tokenid=${token}`
              : `${this.wssHost}/be_kmehr/generateMedicationScheme;sessionid=${sessionId}`
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
    )
  }
}
