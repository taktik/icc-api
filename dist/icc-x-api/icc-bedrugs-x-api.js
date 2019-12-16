"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
class IccBedrugsXApi extends iccApi_1.iccBeDrugsApi {
  constructor(
    host,
    headers,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.atcCache = {}
  }
  getCachedCheapAlternativesBasedOnAtc(medecinePackageId, lang) {
    return (
      this.atcCache[medecinePackageId + "|" + lang] ||
      (this.atcCache[medecinePackageId + "|" + lang] = this.getCheapAlternativesBasedOnAtc(
        medecinePackageId,
        lang
      ))
    )
  }
}
exports.IccBedrugsXApi = IccBedrugsXApi
//# sourceMappingURL=icc-bedrugs-x-api.js.map
