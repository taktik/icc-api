import { iccBeDrugsApi } from "../icc-api/iccApi"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

export class IccBedrugsXApi extends iccBeDrugsApi {
  atcCache: { [key: string]: Promise<Array<models.MppPreview>> } = {}

  constructor(
    host: string,
    headers: { [key: string]: string },
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : (self.fetch as any)
  ) {
    super(host, headers, fetchImpl)
  }

  getCachedCheapAlternativesBasedOnAtc(
    medecinePackageId: string,
    lang: string
  ): Promise<Array<models.MppPreview> | any> {
    return (
      this.atcCache[medecinePackageId + "|" + lang] ||
      (this.atcCache[medecinePackageId + "|" + lang] = this.getCheapAlternativesBasedOnAtc(
        medecinePackageId,
        lang
      ))
    )
  }
}
