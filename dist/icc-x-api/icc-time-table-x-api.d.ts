import { iccTimeTableApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { UserDto } from "../icc-api/model/UserDto"
import { TimeTableDto } from "../icc-api/model/TimeTableDto"
export declare class IccTimeTableXApi extends iccTimeTableApi {
  i18n: any
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
    user: UserDto,
    tt: TimeTableDto
  ): Promise<
    {
      id: string
      _type: string
      created: number
      modified: number
      responsible: string | undefined
      author: string | undefined
      codes: never[]
      tags: never[]
    } & TimeTableDto
  >
}
