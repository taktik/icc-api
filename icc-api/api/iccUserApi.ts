/**
 *
 * No description provided (generated by Swagger Codegen https://github.com/swagger-api/swagger-codegen)
 *
 * OpenAPI spec version: 1.0.2
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { XHR } from "./XHR"
import * as models from "../model/models"

export class iccUserApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.Data) {
    if (e.status == 401) throw Error("auth-failed")
    else throw Error("api-error" + e.status)
  }

  assignHealthcareParty(healthcarePartyId: string): Promise<models.UserDto | any> {
    let _body = null

    const _url =
      this.host +
      "/user/current/hcparty/{healthcarePartyId}".replace(
        "{healthcarePartyId}",
        healthcarePartyId + ""
      ) +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  checkPassword(password?: string): Promise<boolean | any> {
    let _body = null

    const _url = this.host + "/user/checkPassword" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    password && (headers = headers.concat(new XHR.Header("password", password)))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  createUser(body?: models.UserDto): Promise<models.UserDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/user" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  deleteUser(userId: string): Promise<Array<string> | any> {
    let _body = null

    const _url =
      this.host + "/user/{userId}".replace("{userId}", userId + "") + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => JSON.parse(JSON.stringify(it))))
      .catch(err => this.handleError(err))
  }
  findByHcpartyId(id: string): Promise<Array<string> | any> {
    let _body = null

    const _url =
      this.host +
      "/user/byHealthcarePartyId/{id}".replace("{id}", id + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => JSON.parse(JSON.stringify(it))))
      .catch(err => this.handleError(err))
  }
  forgottenPassword(email: string, body?: models.EmailTemplateDto): Promise<boolean | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/user/forgottenPassword/{email}".replace("{email}", email + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  getCurrentSession(): Promise<string | any> {
    let _body = null

    const _url = this.host + "/user/session" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  getCurrentUser(): Promise<models.UserDto | any> {
    let _body = null

    const _url = this.host + "/user/current" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getMatchingUsers(): Promise<Array<models.UserDto> | any> {
    let _body = null

    const _url = this.host + "/user/matches" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.UserDto(it)))
      .catch(err => this.handleError(err))
  }
  getUser(userId: string): Promise<models.UserDto | any> {
    let _body = null

    const _url =
      this.host + "/user/{userId}".replace("{userId}", userId + "") + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getUserByEmail(email: string): Promise<models.UserDto | any> {
    let _body = null

    const _url =
      this.host +
      "/user/byEmail/{email}".replace("{email}", email + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  listUsers(
    startKey?: string,
    startDocumentId?: string,
    limit?: string
  ): Promise<models.UserPaginatedList | any> {
    let _body = null

    const _url =
      this.host +
      "/user" +
      "?ts=" +
      new Date().getTime() +
      (startKey ? "&startKey=" + startKey : "") +
      (startDocumentId ? "&startDocumentId=" + startDocumentId : "") +
      (limit ? "&limit=" + limit : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserPaginatedList(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  modifyProperties(
    userId: string,
    body?: Array<models.PropertyDto>
  ): Promise<models.UserDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/user/{userId}/properties".replace("{userId}", userId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  modifyUser(body?: models.UserDto): Promise<models.UserDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/user" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.UserDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
