import { iccUserApi } from "../icc-api/api/iccUserApi"
import * as models from "../icc-api/model/models"
export declare class IccUserXApi extends iccUserApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  getCurrentSessionWithSession(sessionId: string): Promise<string | any>
  getCurrentUserWithSession(sessionId: string): Promise<models.UserDto | any>
}
