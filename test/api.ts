import {
  IccContactXApi,
  IccCryptoXApi,
  IccHcpartyXApi,
  IccPatientXApi,
  IccHelementXApi,
  IccUserXApi,
  IccFormXApi,
  IccInvoiceXApi,
  IccDocumentXApi,
  IccClassificationXApi,
  IccCalendarItemXApi
} from "../icc-x-api"

import { iccPatientApi, iccEntityrefApi, iccBekmehrApi, iccAuthApi } from "../icc-api/iccApi"

import fetch from "node-fetch"
import * as WebCrypto from "node-webcrypto-ossl"
import { UserDto } from "../icc-api/model/UserDto"

export class Api {
  private _entityreficc: iccEntityrefApi
  private _authicc: iccAuthApi
  private _usericc: IccUserXApi
  private _hcpartyicc: IccHcpartyXApi
  private _cryptoicc: IccCryptoXApi
  private _contacticc: IccContactXApi
  private _formicc: IccFormXApi
  private _helementicc: IccHelementXApi
  private _invoiceicc: IccInvoiceXApi
  private _documenticc: IccDocumentXApi
  private _classificationicc: IccClassificationXApi
  private _calendaritemicc: IccCalendarItemXApi
  private _bekmehricc: iccBekmehrApi
  private _patienticc: IccPatientXApi

  private _currentUser: UserDto | null

  constructor(
    host: string,
    headers: { [key: string]: string },
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this._currentUser = null
    this._authicc = new iccAuthApi(host, headers, fetchImpl)
    this._entityreficc = new iccEntityrefApi(host, headers, fetchImpl)
    this._usericc = new IccUserXApi(host, headers, fetchImpl)
    this._hcpartyicc = new IccHcpartyXApi(host, headers, fetchImpl)
    this._cryptoicc = new IccCryptoXApi(
      host,
      headers,
      this._hcpartyicc,
      new iccPatientApi(host, headers, fetchImpl),
      new WebCrypto()
    )
    this._contacticc = new IccContactXApi(host, headers, this._cryptoicc, fetchImpl)
    this._formicc = new IccFormXApi(host, headers, this._cryptoicc, fetchImpl)
    this._invoiceicc = new IccInvoiceXApi(
      host,
      headers,
      this._cryptoicc,
      this._entityreficc,
      fetchImpl
    )
    this._documenticc = new IccDocumentXApi(
      host,
      headers,
      this._cryptoicc,
      this._authicc,
      fetchImpl
    )
    this._helementicc = new IccHelementXApi(host, headers, this._cryptoicc, fetchImpl)
    this._classificationicc = new IccClassificationXApi(host, headers, this._cryptoicc, fetchImpl)
    this._bekmehricc = new iccBekmehrApi(host, headers, fetchImpl)
    this._calendaritemicc = new IccCalendarItemXApi(host, headers, this._cryptoicc, fetchImpl)
    this._patienticc = new IccPatientXApi(
      host,
      headers,
      this._cryptoicc,
      this._contacticc,
      this._formicc,
      this._helementicc,
      this._invoiceicc,
      this._documenticc,
      this._hcpartyicc,
      this._classificationicc,
      this._calendaritemicc,
      ["note"],
      fetchImpl
    )

    this._usericc.getCurrentUser().then((u: UserDto) => (this._currentUser = u))
  }

  get hcpartyicc(): IccHcpartyXApi {
    return this._hcpartyicc
  }

  get patienticc(): IccPatientXApi {
    return this._patienticc
  }

  get cryptoicc(): IccCryptoXApi {
    return this._cryptoicc
  }

  get contacticc(): IccContactXApi {
    return this._contacticc
  }

  get formicc(): IccFormXApi {
    return this._formicc
  }

  get helementicc(): IccHelementXApi {
    return this._helementicc
  }

  get usericc(): IccUserXApi {
    return this._usericc
  }

  get invoiceicc(): IccInvoiceXApi {
    return this._invoiceicc
  }

  get documenticc(): IccDocumentXApi {
    return this._documenticc
  }

  get bekmehricc(): iccBekmehrApi {
    return this._bekmehricc
  }

  get classificationicc(): IccClassificationXApi {
    return this._classificationicc
  }

  get entityreficc(): iccEntityrefApi {
    return this._entityreficc
  }

  get currentUser(): UserDto | null {
    return this._currentUser
  }
}
