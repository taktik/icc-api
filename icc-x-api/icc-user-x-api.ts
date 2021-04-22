import { IccUserApi } from '../icc-api/api/IccUserApi'
import { b2a } from './utils/binary-utils'

export class IccUserXApi extends IccUserApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: { [key: string]: string },
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.fetchImpl = fetchImpl
  }
}
