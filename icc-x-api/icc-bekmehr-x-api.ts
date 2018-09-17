import { iccBekmehrApi } from "../icc-api/iccApi"

import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHelementXApi } from "./icc-helement-x-api"

export class IccBekmehrXApi extends iccBekmehrApi {
  private readonly ctcApi: IccContactXApi
  private readonly helementApi: IccHelementXApi
  private readonly wssHost: string

  constructor(
    host: string,
    headers: Array<XHR.Header>,
    ctcApi: IccContactXApi,
    helementApi: IccHelementXApi
  ) {
    super(host, headers)
    this.ctcApi = ctcApi
    this.helementApi = helementApi

    const auth = this.headers.find(h => h.header === "Authorization")
    this.wssHost = new URL(this.host, window.location.href).href
      .replace(/^http/, "ws")
      .replace(/:\/\//, "://" + (auth ? atob(auth.data.replace(/Basic /, "")) + "@" : ""))
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
    progressCallback?: (progress: number) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.wssHost + "/be_kmehr/generateSmf")
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
    body: models.SumehrExportInfoDto
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.wssHost + "/be_kmehr/generateSumehr")
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
}
