"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccUserApi_1 = require("../icc-api/api/iccUserApi")
const XHR_1 = require("../icc-api/api/XHR")
const models = require("../icc-api/model/models")
class IccUserXApi extends iccUserApi_1.iccUserApi {
  constructor(
    host,
    headers,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.fetchImpl = fetchImpl
  }
  getCurrentSessionWithSession(sessionId) {
    if (!sessionId) {
      return super.getCurrentSession()
    }
    let _body = null
    const _url = `${this.host}/user/session;jsessionid=${sessionId}?ts=${new Date().getTime()}`
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  getCurrentUserWithSession(sessionId) {
    if (!sessionId) {
      return super.getCurrentUser()
    }
    let _body = null
    const _url = `${this.host}/user/current;jsessionid=${sessionId}?ts=${new Date().getTime()}`
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body))
      .catch(err => this.handleError(err))
  }
}
exports.IccUserXApi = IccUserXApi
//# sourceMappingURL=icc-user-x-api.js.map
