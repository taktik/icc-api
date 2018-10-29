import { iccHcpartyApi } from "../icc-api/iccApi"

import { XHR } from "../icc-api/api/XHR"

// noinspection JSUnusedGlobalSymbols
export class IccHcpartyXApi extends iccHcpartyApi {
  hcPartyKeysCache: { [key: string]: string } = {}

  constructor(host: string, headers: Array<XHR.Header>) {
    super(host, headers)
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
