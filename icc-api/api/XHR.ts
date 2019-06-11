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
    status: number
    contentType: string
    body: JSON | Array<JSON> | any //stream bytes|json|array<json>

    constructor(status: number, contentType: string, body: JSON | Array<JSON> | any) {
      this.status = status
      this.contentType = contentType
      this.body = body
    }
  }

  export class XHRError extends Error {
    status: number
    code: number
    headers: Headers

    constructor(message: string, status: number, code: number, headers: Headers) {
      super(message)
      this.status = status
      this.code = code
      this.headers = headers
    }
  }

  export function sendCommand(
    method: string,
    url: string,
    headers: Array<Header> | null,
    data: string | any = ""
  ): Promise<Data> {
    const contentType =
      headers &&
      headers.find(it => (it.header ? it.header.toLowerCase() === "content-type" : false))

    return fetch(
      url,
      Object.assign(
        {
          method: method,
          credentials: "include",
          headers:
            (headers &&
              headers
                .filter(
                  h => h.header.toLowerCase() !== "content-type" || h.data !== "multipart/form-data"
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
                (!contentType || contentType.data) === "application/json"
                  ? JSON.stringify(data)
                  : data
            }
          : {}
      )
    ).then(function(response) {
      if (response.status >= 400) {
        throw new XHRError(response.statusText, response.status, response.status, response.headers)
      }
      const ct = response.headers.get("content-type") || "text/plain"
      return (ct.startsWith("application/json")
        ? response.json()
        : ct.startsWith("application/xml") || ct.startsWith("text/")
          ? response.text()
          : response.arrayBuffer()
      ).then(d => new Data(response.status, ct, d))
    })
  }
}
