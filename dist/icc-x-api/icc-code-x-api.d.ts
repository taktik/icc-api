import { iccCodeApi } from "../icc-api/iccApi"
import { CodeDto } from "../icc-api/model/CodeDto"
export declare class IccCodeXApi extends iccCodeApi {
  icd10: any
  icpc2: any
  codeLanguages: any
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  icdChapters(listOfCodes: Array<string>): Promise<any[]>
  icpcChapters(listOfCodes: Array<string>): Promise<any[]>
  languageForType(type: string, lng: string): string
  normalize(
    c: CodeDto | string
  ):
    | {
        id: string
        type: string | undefined
        code: string | undefined
        version: string
      }
    | {
        id: string | undefined
        type: string
        code: string
        version: string
      }
}
