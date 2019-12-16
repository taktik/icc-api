import { iccBeDrugsApi } from "../icc-api/iccApi"
import * as models from "../icc-api/model/models"
export declare class IccBedrugsXApi extends iccBeDrugsApi {
  atcCache: {
    [key: string]: Promise<Array<models.MppPreview>>
  }
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  getCachedCheapAlternativesBasedOnAtc(
    medecinePackageId: string,
    lang: string
  ): Promise<Array<models.MppPreview> | any>
}
