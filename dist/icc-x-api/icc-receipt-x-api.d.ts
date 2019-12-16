import { iccReceiptApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import * as models from "../icc-api/model/models"
import {
  AgreementResponse,
  DmgAcknowledge,
  DmgConsultation,
  DmgNotification,
  DmgRegistration,
  InsurabilityInfoDto,
  TarificationConsultationResult
} from "fhc-api"
export declare class IccReceiptXApi extends iccReceiptApi {
  crypto: IccCryptoXApi
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(user: models.UserDto, r: any): Promise<models.ReceiptDto>
  private initDelegationsAndEncryptionKeys
  initEncryptionKeys(
    user: models.UserDto,
    rcpt: models.ReceiptDto
  ): Promise<
    models.ReceiptDto & {
      encryptionKeys: any
    }
  >
  logReceipt(
    user: models.UserDto,
    docId: string,
    refs: Array<string>,
    blobType: string,
    blob: ArrayBuffer
  ): Promise<any>
  logSCReceipt(
    object:
      | AgreementResponse
      | DmgConsultation
      | DmgAcknowledge
      | DmgConsultation
      | DmgNotification
      | DmgRegistration
      | TarificationConsultationResult
      | InsurabilityInfoDto,
    user: models.UserDto,
    docId: string,
    cat: string,
    subcat: string,
    refs?: Array<string>
  ): Promise<any>
}
