export namespace XHR {
  export class Header {
    header: string
    data: string

    constructor(header: string, data: string) {
      this.header = header
      this.data = data
    }
  }

  export class Data {
    statusCode: number
    contentType: string
    body: JSON | Array<JSON> | any //stream bytes|json|array<json>

    constructor(status: number, contentType: string, body: JSON | Array<JSON> | any) {
      this.statusCode = status
      this.contentType = contentType
      this.body = body
    }
  }

  export class XHRError extends Error {
    statusCode: number
    errorCode: string
    headers: Headers
    message: string

    constructor(message: string, status: number, errorCode: string, headers: Headers) {
      super(message)
      this.statusCode = status
      this.message = message
      this.errorCode = errorCode
      this.headers = headers
    }
  }

  function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout = 10000,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      // Set timeout timer
      let timer = setTimeout(
        () => reject({ message: "Request timed out", status: "Request timed out" }),
        timeout
      )
      fetchImpl(url, init)
        .then(response => {
          clearTimeout(timer)
          resolve(response)
        })
        .catch(err => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }

  export function sendCommand(
    method: string,
    url: string,
    headers: Array<Header> | null,
    data: string | any = "",
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch,
    contentTypeOverride?: "application/json" | "text/plain" | "application/octet-stream"
  ): Promise<Data> {
    const contentType =
      headers &&
      headers.find(it => (it.header ? it.header.toLowerCase() === "content-type" : false))
    const clientTimeout =
      headers &&
      headers.find(it => (it.header ? it.header.toUpperCase() === "X-CLIENT-SIDE-TIMEOUT" : false))
    const timeout = clientTimeout ? Number(clientTimeout.data) : 600000
    return fetchWithTimeout(
      url,
      Object.assign(
        {
          method: method,
          credentials: "include" as RequestCredentials,
          headers:
            (headers &&
              headers
                .filter(
                  h =>
                    (h.header.toLowerCase() !== "content-type" ||
                      h.data !== "multipart/form-data") &&
                    h.header.toUpperCase() !== "X-CLIENT-SIDE-TIMEOUT"
                )
                .reduce((acc: { [key: string]: string }, h) => {
                  acc[h.header] = h.data
                  return acc
                }, {})) ||
            {}
        },
        method === "POST" || method === "PUT"
          ? {
              body:
                !contentType || contentType.data === "application/json"
                  ? JSON.stringify(data, (k, v) => {
                      return v instanceof ArrayBuffer || v instanceof Uint8Array
                        ? btoa(new Uint8Array(v).reduce((d, b) => d + String.fromCharCode(b), ""))
                        : v
                    })
                  : data
            }
          : {}
      ),
      timeout,
      fetchImpl
    ).then(async function(response) {
      if (response.status >= 400) {
        const error: {
          error: string
          message: string
          status: number
        } = await response.blob().then(async data => await new Response(data).json())
        throw new XHRError(error.message, error.status, error.error, response.headers)
      }
      const ct = contentTypeOverride || response.headers.get("content-type") || "text/plain"
      return (ct.startsWith("application/json")
        ? response.json()
        : ct.startsWith("application/xml") || ct.startsWith("text/")
          ? response.text()
          : response.arrayBuffer()
      ).then(d => new Data(response.status, ct, d))
    })
  }
}
