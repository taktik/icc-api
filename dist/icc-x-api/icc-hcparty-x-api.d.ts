import { iccHcpartyApi } from "../icc-api/iccApi"
import { HealthcarePartyDto } from "../icc-api/model/HealthcarePartyDto"
export declare class IccHcpartyXApi extends iccHcpartyApi {
  hcPartyKeysCache: {
    [key: string]: string
  }
  cache: {
    [key: string]: [number, Promise<HealthcarePartyDto>]
  }
  private CACHE_RETENTION_IN_MS
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  modifyHealthcareParty(body?: HealthcarePartyDto): Promise<HealthcarePartyDto | any>
  getHealthcareParty(healthcarePartyId: string): Promise<HealthcarePartyDto | any>
  getHealthcareParties(healthcarePartyIds: string): Promise<Array<HealthcarePartyDto> | any>
  getCurrentHealthcareParty(): Promise<HealthcarePartyDto | any>
  getHcPartyKeysForDelegate(healthcarePartyId: string): Promise<any>
  isValidCbe(cbe: string): boolean
}
