import { iccUserApi } from "../icc-api/api/iccUserApi"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

export class IccUserXApi extends iccUserApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: { [key: string]: string },
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = window.fetch
  ) {
    super(host, headers, fetchImpl)
    this.fetchImpl = fetchImpl
  }

  getCurrentSessionWithSession(sessionId: string): Promise<string | any> {
    if (!sessionId) {
      return super.getCurrentSession()
    }

    let _body = null

    const _url = `${this.host}/user/session;jsessionid=${sessionId}?ts=${new Date().getTime()}`
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }

  getCurrentUserWithSession(sessionId: string): Promise<models.UserDto | any> {
    if (!sessionId) {
      return super.getCurrentUser()
    }

    let _body = null

    const _url = `${this.host}/user/current;jsessionid=${sessionId}?ts=${new Date().getTime()}`
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
