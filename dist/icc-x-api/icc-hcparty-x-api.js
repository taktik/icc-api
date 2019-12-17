"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const _ = require("lodash")
// noinspection JSUnusedGlobalSymbols
class IccHcpartyXApi extends iccApi_1.iccHcpartyApi {
  constructor(
    host,
    headers,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.hcPartyKeysCache = {}
    this.cache = {}
    this.CACHE_RETENTION_IN_MS = 300000
  }
  modifyHealthcareParty(body) {
    body && body.id && delete this.cache[body.id]
    return super
      .modifyHealthcareParty(body)
      .then(
        hcp =>
          (this.cache[hcp.id] = [Date.now() + this.CACHE_RETENTION_IN_MS, Promise.resolve(hcp)])[1]
      )
  }
  getHealthcareParty(healthcarePartyId) {
    const fromCache = this.cache[healthcarePartyId]
    return !fromCache || Date.now() > fromCache[0]
      ? (this.cache[healthcarePartyId] = [
          Date.now() + this.CACHE_RETENTION_IN_MS,
          super.getHealthcareParty(healthcarePartyId).catch(e => {
            delete this.cache[healthcarePartyId]
            throw e
          })
        ])[1]
      : fromCache[1]
  }
  getHealthcareParties(healthcarePartyIds) {
    const ids = healthcarePartyIds.split(",").filter(x => !!x)
    const cached = ids.map(x => {
      const c = this.cache[x]
      return c && c[0] > Date.now() ? c : null
    })
    const toFetch = _.compact(ids.map((id, idx) => (!cached[idx] ? id : null)))
    if (!toFetch.length) {
      return Promise.all(cached.map(c => c[1]))
    }
    const prom = super.getHealthcareParties(toFetch.join(","))
    ids.forEach((id, idx) => {
      if (!cached[idx]) {
        this.cache[id] = [
          Date.now() + this.CACHE_RETENTION_IN_MS,
          prom.then(hcps => hcps.find(h => h.id === id))
        ]
      }
    })
    return Promise.all(ids.map(id => this.cache[id][1])).then(hcps => hcps.filter(x => !!x))
  }
  getCurrentHealthcareParty() {
    return super.getCurrentHealthcareParty().then(hcp => {
      this.cache[hcp.id] = [Date.now() + this.CACHE_RETENTION_IN_MS, Promise.resolve(hcp)]
      return hcp
    })
  }
  getHcPartyKeysForDelegate(healthcarePartyId) {
    const cached = this.hcPartyKeysCache[healthcarePartyId]
    return cached
      ? Promise.resolve(cached)
      : super
          .getHcPartyKeysForDelegate(healthcarePartyId)
          .then(r => (this.hcPartyKeysCache[healthcarePartyId] = r))
  }
  isValidCbe(cbe) {
    cbe = cbe.replace(new RegExp("[^(0-9)]", "g"), "")
    cbe = cbe.length == 9 ? "0" + cbe : cbe
    return 97 - (Number(cbe.substr(0, 8)) % 97) === Number(cbe.substr(8, 2)) ? true : false
  }
}
exports.IccHcpartyXApi = IccHcpartyXApi
//# sourceMappingURL=icc-hcparty-x-api.js.map
