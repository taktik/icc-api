import { iccBedrugsApi } from "../icc-api/iccApi"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import * as models from "../icc-api/model/models"

export class IccBedrugsXApi extends iccBedrugsApi {
  atcCache: { [key: string]: Promise<Array<models.MppPreview>> } = {}

  constructor(host: string, headers: { [key: string]: string }) {
    super(host, headers)
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
