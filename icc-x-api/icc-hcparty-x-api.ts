import { iccHcpartyApi } from "../icc-api/iccApi"

import { XHR } from "../icc-api/api/XHR"
import { HealthcarePartyDto } from "../icc-api/model/HealthcarePartyDto"
import _ from "lodash"

// noinspection JSUnusedGlobalSymbols
export class IccHcpartyXApi extends iccHcpartyApi {
  hcPartyKeysCache: { [key: string]: string } = {}
  cache: { [key: string]: [number, Promise<HealthcarePartyDto>] } = {}
  private CACHE_RETENTION_IN_MS: number = 300_000
  constructor(host: string, headers: Array<XHR.Header>) {
    super(host, headers)
  }

  modifyHealthcareParty(body?: HealthcarePartyDto): Promise<HealthcarePartyDto | any> {
    body && body.id && delete this.cache[body.id]
    return super
      .modifyHealthcareParty(body)
      .then(
        hcp =>
          (this.cache[hcp.id] = [+Date() + this.CACHE_RETENTION_IN_MS, Promise.resolve(hcp)])[1]
      )
  }

  getHealthcareParty(healthcarePartyId: string): Promise<HealthcarePartyDto | any> {
    const fromCache = this.cache[healthcarePartyId]
    return !fromCache || +Date() > fromCache[0]
      ? (this.cache[healthcarePartyId] = [
          +Date() + this.CACHE_RETENTION_IN_MS,
          super.getHealthcareParty(healthcarePartyId).catch(e => {
            delete this.cache[healthcarePartyId]
            throw e
          })
        ])[1]
      : fromCache[1]
  }

  getHealthcareParties(healthcarePartyIds: string): Promise<Array<HealthcarePartyDto> | any> {
    const ids = healthcarePartyIds.split(",")
    const cached = ids.map(x => {
      const c = this.cache[x]
      return c && c[0] > +Date() ? c : null
    })
    const toFetch = ids.map((id, idx) => !cached[idx] && id)

    return toFetch.length
      ? super
          .getHealthcareParties(_.compact(toFetch).join(","))
          .then((hcps: Array<HealthcarePartyDto>) =>
            Promise.all(
              ids.map(
                (id, idx) =>
                  cached[idx]
                    ? cached[idx]![1]
                    : (this.cache[id] = [
                        +Date() + this.CACHE_RETENTION_IN_MS,
                        Promise.resolve(hcps.find(h => h.id === id)!)
                      ])[1]
              )
            )
          )
      : Promise.all(cached.map(c => c![1]))
  }

  getCurrentHealthcareParty(): Promise<HealthcarePartyDto | any> {
    return super.getCurrentHealthcareParty().then(hcp => {
      this.cache[hcp.id] = [+Date() + this.CACHE_RETENTION_IN_MS, Promise.resolve(hcp)]
      return hcp
    })
  }

  getHcPartyKeysForDelegate(healthcarePartyId: string) {
    const cached = this.hcPartyKeysCache[healthcarePartyId]
    return cached
      ? Promise.resolve(cached)
      : super
          .getHcPartyKeysForDelegate(healthcarePartyId)
          .then(r => (this.hcPartyKeysCache[healthcarePartyId] = r))
  }

  isValidCbe(cbe: string) {
    cbe = cbe.replace(new RegExp("[^(0-9)]", "g"), "")
    cbe = cbe.length == 9 ? "0" + cbe : cbe

    return 97 - (Number(cbe.substr(0, 8)) % 97) === Number(cbe.substr(8, 2)) ? true : false
  }
}
