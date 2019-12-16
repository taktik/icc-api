"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
var XHR
;(function(XHR) {
  class Header {
    constructor(header, data) {
      this.header = header
      this.data = data
    }
  }
  XHR.Header = Header
  class Data {
    constructor(status, contentType, body) {
      this.status = status
      this.contentType = contentType
      this.body = body
    }
  }
  XHR.Data = Data
  class XHRError extends Error {
    constructor(message, status, code, headers) {
      super(message)
      this.status = status
      this.code = code
      this.headers = headers
    }
  }
  XHR.XHRError = XHRError
  function fetchWithTimeout(
    url,
    init,
    timeout = 10000,
    fetchImpl = typeof window !== "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
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
  function sendCommand(
    method,
    url,
    headers,
    data = "",
    fetchImpl = typeof window !== "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch,
    contentTypeOverride
  ) {
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
          credentials: "include",
          headers:
            (headers &&
              headers
                .filter(
                  h =>
                    (h.header.toLowerCase() !== "content-type" ||
                      h.data !== "multipart/form-data") &&
                    h.header.toUpperCase() !== "X-CLIENT-SIDE-TIMEOUT"
                )
                .reduce((acc, h) => {
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
      ),
      timeout,
      fetchImpl
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
  XHR.sendCommand = sendCommand
})((XHR = exports.XHR || (exports.XHR = {})))
//# sourceMappingURL=XHR.js.map
