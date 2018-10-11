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
    headers: Array<Header> | string
    body: JSON | Array<JSON> | any //stream bytes|json|array<json>
    text: string
    type: string
    status: number
    statusText: string
    contentType: string
    documentContent: Document | null

    constructor(jsXHR: XMLHttpRequest) {
      this.headers = jsXHR
        .getAllResponseHeaders()
        .split("\n")
        .map(h => h.split(": "))
        .map(head => new Header(head[0], head[1]))
      this.contentType = ""
      this.headers.map(head => {
        if (head.header && head.header.toLowerCase() === "content-type") {
          this.contentType = head.data && head.data.toLowerCase()
          if (head.data.startsWith("application/json")) {
            this.body = JSON.parse(jsXHR.response)
          } else if (head.data.startsWith("application/octet-stream")) {
            try {
              this.body = JSON.parse(jsXHR.response.toString())
              console.log("parse done")
            } catch (e) {
              console.log("parse fail")
              this.body = jsXHR.response //todo, somethings else
            }
          } else {
            this.body = jsXHR.response //"text/plain"
          }
        }
      })
      this.documentContent = jsXHR.responseXML
      this.text = jsXHR.responseText
      this.type = jsXHR.responseType
      this.status = jsXHR.status
      this.statusText = jsXHR.statusText
    }
  }

  function dataFromJSXHR(jsXHR: XMLHttpRequest): Data {
    return new Data(jsXHR)
  }

  export function sendCommand(
    method: string,
    url: string,
    headers: Array<Header> | null,
    data: string | any = ""
  ): Promise<Data> {
    return new Promise<Data>(function(resolve, reject) {
      var jsXHR = new XMLHttpRequest()
      jsXHR.open(method, url)
      const contentType =
        headers &&
        headers.find(it => (it.header ? it.header.toLowerCase() === "content-type" : false))
      if (headers != null) {
        headers.forEach(header => {
          if (
            header.header.toLowerCase() !== "content-type" ||
            header.data !== "multipart/form-data"
          ) {
            jsXHR.setRequestHeader(header.header, header.data)
          }
        })
      }

      jsXHR.onload = ev => {
        if (jsXHR.status < 200 || jsXHR.status >= 300) {
          reject(dataFromJSXHR(jsXHR))
        }
        resolve(dataFromJSXHR(jsXHR))
      }
      jsXHR.onerror = ev => {
        reject("Error " + method.toUpperCase() + 'ing data to url "')
      }

      if (method === "POST" || method === "PUT") {
        if (contentType && contentType.data === "application/json") {
          jsXHR.send(JSON.stringify(data))
        } else {
          jsXHR.send(data)
        }
      } else {
        jsXHR.send()
      }
    })
  }

  /*export function get(url: string, headers: Array<Header> = null): Promise<Data> {
        return sendCommand('GET', url, headers);
    }

    export function post(url: string, data: string = "", headers: Array<Header> = null): Promise<Data> {
        return sendCommand('POST', url, headers, data);
    }

    export function put(url: string, data: string = "", headers: Array<Header> = null): Promise<Data> {
        return sendCommand('PUT', url, headers, data);
    }

    export function del(url:string, headers:Array<Header> = null):Promise < Data > {
        return sendCommand('DELETE', url, headers);
    }*/
}
