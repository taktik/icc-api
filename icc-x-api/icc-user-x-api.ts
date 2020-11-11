import { iccUserApi } from "../icc-api/api/iccUserApi"

export class IccUserXApi extends iccUserApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  public static api(
    host: string,
    user: string,
    password: string,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
    const headers = {
      Authorization: `Basic ${Buffer.from(`$username:$password`).toString("base64")}`
    }

    return new IccUserXApi(host, headers, fetchImpl)
  }

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
