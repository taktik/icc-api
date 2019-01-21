import { iccUserApi } from "../icc-api/api/iccUserApi"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

export class IccUserXApi extends iccUserApi {
  constructor(host: string, headers: Array<XHR.Header>) {
    super(host, headers)
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
    return XHR.sendCommand("GET", _url, headers, _body)
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
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
