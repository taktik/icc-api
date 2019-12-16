import { iccDocumentApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import * as models from "../icc-api/model/models"
export declare class IccDocumentXApi extends iccDocumentApi {
  crypto: IccCryptoXApi
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  /** maps invalid UTI values to corresponding MIME type for backward-compatibility (pre-v1.0.117) */
  compatUtiRevDefs: {
    [key: string]: string
  }
  utiRevDefs: {
    [key: string]: string
  }
  utiExts: {
    [key: string]: string
  }
  utiDefs: {
    [key: string]: string
  }
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(user: models.UserDto, message: models.MessageDto, c: any): Promise<models.DocumentDto>
  private initDelegationsAndEncryptionKeys
  initEncryptionKeys(
    user: models.UserDto,
    document: models.DocumentDto
  ): Promise<
    models.DocumentDto & {
      encryptionKeys: any
    }
  >
  findByMessage(hcpartyId: string, message: models.MessageDto): Promise<void | models.DocumentDto[]>
  decrypt(
    hcpartyId: string,
    documents: Array<models.DocumentDto>
  ): Promise<Array<models.DocumentDto> | void>
  getAttachmentAs(
    documentId: string,
    attachmentId: string,
    returnType: "application/octet-stream",
    enckeys?: string,
    fileName?: string
  ): Promise<ArrayBuffer>
  getAttachmentAs(
    documentId: string,
    attachmentId: string,
    returnType: "text/plain",
    enckeys?: string,
    fileName?: string
  ): Promise<string>
  getAttachmentAs(
    documentId: string,
    attachmentId: string,
    returnType: "application/json",
    enckeys?: string,
    fileName?: string
  ): Promise<any>
  getAttachmentUrl(
    documentId: string,
    attachmentId: string,
    sfks: Array<{
      delegatorId: string
      key: CryptoKey
    }>,
    sessionId?: string,
    fileName?: string
  ): string
  uti(mimeType: string, extension: string): string
  mimeType(uti: string): string
}
