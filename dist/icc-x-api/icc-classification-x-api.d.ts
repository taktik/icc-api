import { iccClassificationApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import * as models from "../icc-api/model/models"
export declare class IccClassificationXApi extends iccClassificationApi {
  crypto: IccCryptoXApi
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(
    user: models.UserDto,
    patient: models.PatientDto,
    c: any
  ): Promise<models.ClassificationDto>
  initDelegationsAndEncryptionKeys(
    user: models.UserDto,
    patient: models.PatientDto,
    classification: models.ClassificationDto
  ): Promise<models.ClassificationDto>
  findBy(hcpartyId: string, patient: models.PatientDto): Promise<any>
}
