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

export class iccReplicationApi {
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

  createGroupReplication(replicationHost: string, groupId: string, password: string, protocol?: string, port?: string): Promise<models.ReplicationDto | any> {
    let _body = null
    
    const _url = this.host + "/replication/group/{replicationHost}/{groupId}/{password}".replace("{replicationHost}", replicationHost+"").replace("{groupId}", groupId+"").replace("{password}", password+"") + "?ts=" + new Date().getTime()  + (protocol ? "&protocol=" + protocol : "") + (port ? "&port=" + port : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.ReplicationDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  createReplication(body?: models.ReplicationDto): Promise<models.AccessLogDto | any> {
    let _body = null
    _body = body
    
    const _url = this.host + "/replication" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.AccessLogDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  createStandardReplication(replicationHost: string): Promise<models.AccessLogDto | any> {
    let _body = null
    
    const _url = this.host + "/replication/standard/{replicationHost}".replace("{replicationHost}", replicationHost+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.AccessLogDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  createTemplateReplication(replicationHost: string, language: string, specialtyCode: string, protocol?: string, port?: string): Promise<models.ReplicationDto | any> {
    let _body = null
    
    const _url = this.host + "/replication/template/{replicationHost}/{language}/{specialtyCode}".replace("{replicationHost}", replicationHost+"").replace("{language}", language+"").replace("{specialtyCode}", specialtyCode+"") + "?ts=" + new Date().getTime()  + (protocol ? "&protocol=" + protocol : "") + (port ? "&port=" + port : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.ReplicationDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  deleteReplication(replicationId: string): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/replication/{replicationId}".replace("{replicationId}", replicationId+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  getReplication(replicationId: string): Promise<models.ReplicationDto | any> {
    let _body = null
    
    const _url = this.host + "/replication/{replicationId}".replace("{replicationId}", replicationId+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.ReplicationDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  listReplications(): Promise<Array<models.ReplicationDto> | any> {
    let _body = null
    
    const _url = this.host + "/replication" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.ReplicationDto(it)))
      .catch(err => this.handleError(err))
}
  modifyReplication(body?: models.ReplicationDto): Promise<models.ReplicationDto | any> {
    let _body = null
    _body = body
    
    const _url = this.host + "/replication" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.ReplicationDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  startTransientReplication(body?: models.ReplicationDto): Promise<models.AccessLogDto | any> {
    let _body = null
    _body = body
    
    const _url = this.host + "/replication/transient" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.AccessLogDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
}

