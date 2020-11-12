import { IccHcpartyApi } from "../icc-api"
import { HealthcareParty } from "../icc-api/model/HealthcareParty"

// noinspection JSUnusedGlobalSymbols
export class IccHcpartyXApi extends IccHcpartyApi {
  hcPartyKeysCache: { [key: string]: { [key: string]: string } } = {}
  hcPartyCache: { [key: string]: [number, Promise<HealthcareParty>] } = {}

  private CACHE_RETENTION_IN_MS: number = 300_000
  constructor(
    host: string,
    headers: { [key: string]: string },
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
    super(host, headers, fetchImpl)
  }

  private getHcPartyFromCache(key: string) {
    const hcpInCache = this.hcPartyCache[key]
    const now = Date.now()
    if (hcpInCache && hcpInCache[0] > now) {
      return hcpInCache[1]
    }
    if (!hcpInCache) {
      console.log(`Cache miss for key ${key} because not in cache`)
    } else {
      console.log(`Cache miss for key ${key} because ${hcpInCache[0]} > ${now}`)
    }
    return null
  }

  putHcPartyInCache(
    key: string,
    value: Promise<HealthcareParty> | null = null
  ): Promise<HealthcareParty> {
    const hcp =
      value ||
      super.getHealthcareParty(key).catch(e => {
        console.log(`Evict key ${key} because of error`)
        delete this.hcPartyCache[key]
        throw e
      })
    this.hcPartyCache[key] = [Date.now() + this.CACHE_RETENTION_IN_MS, hcp]
    return hcp
  }

  modifyHealthcareParty(body?: HealthcareParty): Promise<HealthcareParty | any> {
    if (body && body.id) {
      console.log(`Evict key ${body.id} because of modification`)
      delete this.hcPartyCache[body.id]
    }

    return super
      .modifyHealthcareParty(body)
      .then(hcp => this.putHcPartyInCache(hcp.id!, Promise.resolve(hcp)))
  }

  getHealthcareParty(
    healthcarePartyId: string,
    bypassCache: boolean = false
  ): Promise<HealthcareParty | any> {
    const fromCache = bypassCache ? undefined : this.getHcPartyFromCache(healthcarePartyId)
    return fromCache || this.putHcPartyInCache(healthcarePartyId)
  }

  getHealthcareParties(healthcarePartyIds: string): Promise<Array<HealthcareParty> | any> {
    const ids = healthcarePartyIds.split(",").filter(x => !!x)
    const cached: Array<[string, Promise<HealthcareParty> | null]> = ids.map(id => [
      id,
      this.getHcPartyFromCache(id)
    ])
    const toFetch = cached.filter(x => !x[1]).map(x => x[0])

    if (!toFetch.length) {
      return Promise.all(cached.map(x => x[1]!!))
    }

    const prom: Promise<HealthcareParty[]> = super.getHealthcareParties(toFetch.join(","))
    return Promise.all(
      cached.map(
        x =>
          x[1] || this.putHcPartyInCache(x[0], prom.then(hcps => hcps.find(h => h.id === x[0])!!))
      )
    )
  }

  getCurrentHealthcareParty(): Promise<HealthcareParty | any> {
    return super
      .getCurrentHealthcareParty()
      .then(hcp => this.putHcPartyInCache(hcp.id!, Promise.resolve(hcp)))
  }

  getHcPartyKeysForDelegate(
    healthcarePartyId: string,
    bypassCache = false
  ): Promise<{ [key: string]: string }> {
    const cached = bypassCache ? null : this.hcPartyKeysCache[healthcarePartyId]
    return cached
      ? Promise.resolve(cached)
      : super
          .getHcPartyKeysForDelegate(healthcarePartyId)
          .then(r => (this.hcPartyKeysCache[healthcarePartyId] = r))
  }

  isValidCbe(cbe: string) {
    cbe = cbe.replace(new RegExp("[^(0-9)]", "g"), "")
    cbe = cbe.length == 9 ? "0" + cbe : cbe

    return 97 - (Number(cbe.substr(0, 8)) % 97) === Number(cbe.substr(8, 2))
  }
}
