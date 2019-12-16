import { Moment } from "moment"
export declare class UtilsClass {
  private crypto
  constructor(crypto?: Crypto)
  /**
   * String to Uint8Array
   *
   * @param s
   * @returns {Uint8Array}
   */
  text2ua(s: string): Uint8Array
  ua2ArrayBuffer(ua: Uint8Array): ArrayBuffer
  base64toArrayBuffer(s: string): ArrayBuffer
  /**
   * Hex String to Uint8Array
   *
   * @param s
   * @returns {Uint8Array}
   */
  hex2ua(s: string): Uint8Array
  spkiToJwk(
    buf: Uint8Array
  ): {
    kty: string
    n: string
    e: string
  }
  pkcs8ToJwk(
    buf: Uint8Array
  ): {
    kty: string
    n: string
    e: string
    d: string
    p: string
    q: string
    dp: string
    dq: string
    qi: string
  }
  minimalRep(b: Uint8Array): Uint8Array
  utf82ua(str: string): Uint8Array
  ua2utf8(arrBuf: Uint8Array | ArrayBuffer): string
  base64url(b: Uint8Array): string
  /**
   * Uint8Array/ArrayBuffer to hex String
   *
   * @param _ua {Uint8Array} or ArrayBuffer
   * @returns {String} Hex String
   */
  ua2hex(_ua: Uint8Array | ArrayBuffer): string
  /**
   * ArrayBuffer to String - resilient to large ArrayBuffers.
   *
   * @param arrBuf
   * @returns {string}
   */
  ua2text(arrBuf: Uint8Array | ArrayBuffer): string
  hex2text(hexStr: string): string
  text2hex(text: string): string
  base64toByteArray(base64Data: string): Array<Uint8Array>
  /**
   *
   * @param buffer1 {Uint8Array}
   * @param buffer2{ Uint8Array}
   * @returns {ArrayBuffer}
   */
  appendBuffer(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer
  after(d1: number, d2: number): boolean
  before(d1: number, d2: number): boolean
  moment(epochOrLongCalendar: number): Moment | null
  /**
   * Encrypt object graph recursively
   *
   * @param obj the object to encrypt
   * @param cryptor the cryptor function (returns a promise)
   * @param keys the keys to be crypted: ex for a Patient ['note', 'addresses.*.["street", "houseNumber", "telecoms.*.telecomNumber"]']
   */
  crypt(
    obj: any,
    cryptor: (
      obj: {
        [key: string]: string
      }
    ) => Promise<ArrayBuffer>,
    keys: Array<string>
  ): Promise<any>
  /**
   * Decrypt object graph recursively
   *
   * @param obj the object to encrypt
   * @param decryptor the decryptor function (returns a promise)
   */
  decrypt(
    obj: any,
    decryptor: (
      obj: Uint8Array
    ) => Promise<{
      [key: string]: string
    }>
  ): Promise<any>
}
export declare const utils: UtilsClass
