import { iccBeKmehrApi } from "../icc-api/iccApi"
import * as models from "../icc-api/model/models"
import { IccContactXApi } from "./icc-contact-x-api"
import { IccHelementXApi } from "./icc-helement-x-api"
export declare class IccBekmehrXApi extends iccBeKmehrApi {
  private readonly ctcApi
  private readonly helementApi
  private readonly wssHost
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    ctcApi: IccContactXApi,
    helementApi: IccHelementXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  socketEventListener(
    socket: WebSocket,
    healthcarePartyId: string,
    resolve: (value?: Promise<Blob>) => void,
    reject: (reason?: any) => void,
    progressCallback?: (progress: number) => void
  ): (event: MessageEvent) => void
  generateSmfExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SoftwareMedicalFileExportDto,
    progressCallback?: (progress: number) => void,
    sessionId?: string
  ): Promise<Blob>
  generateSumehrExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob>
  generateSumehrV2ExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob>
  generateDiaryNoteExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfoDto,
    sessionId?: string
  ): Promise<Blob>
  generateMedicationSchemeWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    version: number,
    body: models.MedicationSchemeExportInfoDto,
    sessionId?: string
  ): Promise<Blob>
}
