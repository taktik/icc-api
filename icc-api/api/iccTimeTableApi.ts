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

export class iccTimeTableApi {
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

  createTimeTable(body?: models.TimeTableDto): Promise<models.TimeTableDto | any> {
    let _body = null
    _body = body
    
    const _url = this.host + "/timeTable" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.TimeTableDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  deleteTimeTable(timeTableIds: string): Promise<any | Boolean> {
    let _body = null
    
    const _url = this.host + "/timeTable/{timeTableIds}".replace("{timeTableIds}", timeTableIds+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => (true))
      .catch(err => this.handleError(err))
}
  getTimeTable(timeTableId: string): Promise<models.TimeTableDto | any> {
    let _body = null
    
    const _url = this.host + "/timeTable/{timeTableId}".replace("{timeTableId}", timeTableId+"") + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.TimeTableDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
  getTimeTablesByAgendaId(agendaId?: string): Promise<Array<models.TimeTableDto> | any> {
    let _body = null
    
    const _url = this.host + "/timeTable/byAgendaId" + "?ts=" + new Date().getTime()  + (agendaId ? "&agendaId=" + agendaId : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.TimeTableDto(it)))
      .catch(err => this.handleError(err))
}
  getTimeTablesByPeriodAndAgendaId(startDate?: number, endDate?: number, agendaId?: string): Promise<Array<models.TimeTableDto> | any> {
    let _body = null
    
    const _url = this.host + "/timeTable/byPeriodAndAgendaId" + "?ts=" + new Date().getTime()  + (startDate ? "&startDate=" + startDate : "") + (endDate ? "&endDate=" + endDate : "") + (agendaId ? "&agendaId=" + agendaId : "")
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.TimeTableDto(it)))
      .catch(err => this.handleError(err))
}
  modifyTimeTable(body?: models.TimeTableDto): Promise<models.TimeTableDto | any> {
    let _body = null
    _body = body
    
    const _url = this.host + "/timeTable" + "?ts=" + new Date().getTime() 
    let headers = this.headers
    headers = headers.filter(h => h.header !== "Content-Type").concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc =>  new models.TimeTableDto(doc.body as JSON))
      .catch(err => this.handleError(err))
}
}

