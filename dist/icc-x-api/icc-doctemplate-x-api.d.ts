import { iccDoctemplateApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import * as models from "../icc-api/model/models"
import { DocumentTemplateDto } from "../icc-api/model/models"
export declare class IccDoctemplateXApi extends iccDoctemplateApi {
  crypto: IccCryptoXApi
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(user: models.UserDto, template: string, c: any): Promise<DocumentTemplateDto>
  findAllByOwnerId(ownerId: string): Promise<Array<models.DocumentTemplateDto>>
  getAttachmentUrl(documentId: string, attachmentId: string): string
  getAttachmentText(documentTemplateId: string, attachmentId: string): Promise<any | Boolean>
}
