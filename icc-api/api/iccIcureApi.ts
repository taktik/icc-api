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

export class iccIcureApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(host: string, headers: any, fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
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

  getIndexingInfo(): Promise<models.IndexingInfoDto | any> {
    let _body = null
    
    const _url = this.host + "/icure/i" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.IndexingInfoDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getProcessInfo(): Promise<string | any> {
    let _body = null
    
    const _url = this.host + "/icure/p" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
}
  getPropertyTypes(type: string): Promise<Array<string> | any> {
    let _body = null
    
    const _url = this.host + "/icure/propertytypes/{type}".replace("{type}", type+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => JSON.parse(JSON.stringify(it))))
      .catch(err => this.handleError(err))
}
  getReplicationInfo(): Promise<models.ReplicationInfoDto | any> {
    let _body = null
    
    const _url = this.host + "/icure/r" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.ReplicationInfoDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getUsers(): Promise<Array<models.UserStubDto> | any> {
    let _body = null
    
    const _url = this.host + "/icure/u" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.UserStubDto(it)))
      .catch(err => this.handleError(err))
}
  getVersion(): Promise<string | any> {
    let _body = null
    
    const _url = this.host + "/icure/v" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
}
  isPatientReady(): Promise<string | any> {
    let _body = null
    
    const _url = this.host + "/icure/pok" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
}
  isReady(): Promise<string | any> {
    let _body = null
    
    const _url = this.host + "/icure/ok" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
}
  resolveContactsConflicts(): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/icure/conflicts/contact" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  resolveDocumentsConflicts(ids?: string): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/icure/conflicts/document" + "?ts=" + new Date().getTime()  + (ids ? "&ids=" + ids : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  resolveFormsConflicts(): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/icure/conflicts/form" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  resolveHealthElementsConflicts(): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/icure/conflicts/healthelement" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  resolveInvoicesConflicts(): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/icure/conflicts/invoice" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  resolveMessagesConflicts(): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/icure/conflicts/message" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  resolvePatientsConflicts(): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/icure/conflicts/patient" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  updateDesignDoc(entityName: string, warmup?: boolean): Promise<boolean | any> {
    let _body = null
    
    const _url = this.host + "/icure/dd/{entityName}".replace("{entityName}", entityName+"") + "?ts=" + new Date().getTime()  + (warmup ? "&warmup=" + warmup : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc =>  JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
}
}

