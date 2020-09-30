import { iccUserApi } from "../icc-api/api/iccUserApi"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

export class IccUserXApi extends iccUserApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: { [key: string]: string },
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
    super(host, headers, fetchImpl)
    this.fetchImpl = fetchImpl
  }
}
