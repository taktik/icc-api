/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from "./XHR"
import { DatabaseInitialisationDto } from "../model/DatabaseInitialisationDto"
import { GroupDto } from "../model/GroupDto"
import { ListOfIdsDto } from "../model/ListOfIdsDto"
import { ListOfPropertiesDto } from "../model/ListOfPropertiesDto"
import { RegistrationInformationDto } from "../model/RegistrationInformationDto"
import { RegistrationSuccessDto } from "../model/RegistrationSuccessDto"
import { ReplicationInfoDto } from "../model/ReplicationInfoDto"
import { Unit } from "../model/Unit"

export class iccGroupApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = host
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Create a new group and associated dbs.  The created group will be manageable by the users that belong to the same group as the one that called createGroup. Several tasks can be executed during the group creation like DB replications towards the created DBs, users creation and healthcare parties creation
   * @summary Create a group
   * @param body
   * @param id The id of the group, also used for subsequent authentication against the db (can only contain digits, letters, - and _)
   * @param name The name of the group
   * @param password The password of the group (can only contain digits, letters, - and _)
   * @param server The server on which the group dbs will be created
   * @param q The number of shards for patient and healthdata dbs : 3-8 is a recommended range of value
   * @param n The number of replications for dbs : 3 is a recommended value
   */
  createGroup(
    id: string,
    name: string,
    password: string,
    server?: string,
    q?: number,
    n?: number,
    body?: DatabaseInitialisationDto
  ): Promise<GroupDto> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}` +
      "?ts=" +
      new Date().getTime() +
      (name ? "&name=" + encodeURIComponent(String(name)) : "") +
      (server ? "&server=" + encodeURIComponent(String(server)) : "") +
      (q ? "&q=" + encodeURIComponent(String(q)) : "") +
      (n ? "&n=" + encodeURIComponent(String(n)) : "")
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    password && (headers = headers.concat(new XHR.Header("password", password)))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => new GroupDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a group by id
   * @summary Get a group by id
   * @param id The id of the group
   */
  getGroup(id: string): Promise<GroupDto> {
    let _body = null

    const _url =
      this.host + `/group/${encodeURIComponent(String(id))}` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => new GroupDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get index info
   * @param id The id of the group
   */
  getReplicationInfo1(id: string): Promise<ReplicationInfoDto> {
    let _body = null

    const _url =
      this.host + `/group/${encodeURIComponent(String(id))}/r` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => new ReplicationInfoDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Init design docs for provided group
   * @summary Init design docs
   * @param id The id of the group
   * @param clazz The class of the design doc
   * @param warmup Warmup the design doc
   */
  initDesignDocs(id: string, clazz?: string, warmup?: boolean): Promise<Unit> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/dd` +
      "?ts=" +
      new Date().getTime() +
      (clazz ? "&clazz=" + encodeURIComponent(String(clazz)) : "") +
      (warmup ? "&warmup=" + encodeURIComponent(String(warmup)) : "")
    let headers = this.headers
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * List existing groups
   * @summary List groups
   */
  listGroups(): Promise<Array<GroupDto>> {
    let _body = null

    const _url = this.host + `/group` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new GroupDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Update existing group name
   * @summary Update group name
   * @param id The id of the group
   * @param name The new name for the group
   */
  modifyGroupName(id: string, name: string): Promise<GroupDto> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/name/${encodeURIComponent(String(name))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new GroupDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Update existing group properties
   * @summary Update group properties
   * @param body
   * @param id The id of the group
   */
  modifyGroupProperties(id: string, body?: ListOfPropertiesDto): Promise<GroupDto> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/properties` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new GroupDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Create a new group and associated dbs.  The created group will be manageable by the users that belong to the same group as the one that called createGroup. Several tasks can be executed during the group creation like DB replications towards the created DBs, users creation and healthcare parties creation
   * @summary Create a group
   * @param body
   */
  registerNewGroupAdministrator(
    body?: RegistrationInformationDto
  ): Promise<RegistrationSuccessDto> {
    let _body = null
    _body = body

    const _url = this.host + `/group/register/trial` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => new RegistrationSuccessDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Reset storage
   * @summary Reset storage for group
   * @param body
   * @param id The id of the group
   * @param q The number of shards for patient and healthdata dbs : 3-8 is a recommended range of value
   * @param n The number of replications for dbs : 3 is a recommended value
   */
  resetStorage(id: string, q?: number, n?: number, body?: ListOfIdsDto): Promise<Unit> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/reset/storage` +
      "?ts=" +
      new Date().getTime() +
      (q ? "&q=" + encodeURIComponent(String(q)) : "") +
      (n ? "&n=" + encodeURIComponent(String(n)) : "")
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Update password for provided group
   * @summary Set group password
   * @param id The id of the group
   * @param password The new password for the group (can only contain digits, letters, - and _)
   */
  setGroupPassword(id: string, password: string): Promise<GroupDto> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/password` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    password && (headers = headers.concat(new XHR.Header("password", password)))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new GroupDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Solve conflicts for group
   * @summary Solve conflicts for group
   * @param id The id of the group
   * @param warmup Warmup the design doc
   */
  solveConflicts(id: string, warmup?: boolean): Promise<Unit> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/conflicts` +
      "?ts=" +
      new Date().getTime() +
      (warmup ? "&warmup=" + encodeURIComponent(String(warmup)) : "")
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
