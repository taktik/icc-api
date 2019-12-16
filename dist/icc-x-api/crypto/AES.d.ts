export declare class AESUtils {
  /********* AES Config **********/
  ivLength: number
  aesAlgorithmEncryptName: string
  aesKeyGenParams: {
    name: string
    length: number
  }
  private crypto
  constructor(crypto?: Crypto)
  encrypt(cryptoKey: CryptoKey, plainData: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>
  /**
   *
   * @param cryptoKey (CryptoKey)
   * @param encryptedData (ArrayBuffer)
   * @returns {Promise} will be ArrayBuffer
   */
  decrypt(cryptoKey: CryptoKey, encryptedData: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>
  /**
   *
   * @param toHex boolean, if true, it returns hex String
   * @returns {Promise} either Hex string or CryptoKey
   */
  generateCryptoKey(toHex: boolean): Promise<string | CryptoKey>
  generateIV(
    ivByteLength: number
  ):
    | Int8Array
    | Int16Array
    | Int32Array
    | Uint8Array
    | Uint16Array
    | Uint32Array
    | Uint8ClampedArray
    | Float32Array
    | Float64Array
    | DataView
    | null
  /**
   * This function return a promise which will be the key Format will be either 'raw' or 'jwk'.
   * JWK: Json Web key (ref. http://tools.ietf.org/html/draft-ietf-jose-json-web-key-11)
   *
   * @param cryptoKey CryptoKey
   * @param format will be 'raw' or 'jwk'
   * @returns {Promise} will the AES Key
   */
  exportKey(cryptoKey: CryptoKey, format: string): Promise<ArrayBuffer | JsonWebKey>
  /**
   * the ability to import a key that have already been created elsewhere, for use within the web
   * application that is invoking the import function, for use within the importing web application's
   * origin. This necessiates an interoperable key format, such as JSON Web Key [JWK] which may be
   * represented as octets.
   *
   * https://chromium.googlesource.com/chromium/blink.git/+/6b902997e3ca0384c8fa6fe56f79ecd7589d3ca6/LayoutTests/crypto/resources/common.js
   *
   * @param format 'raw' or 'jwk'
   * @param aesKey
   * @returns {*}
   */
  importKey(format: string, aesKey: JsonWebKey | ArrayBuffer | Uint8Array): Promise<CryptoKey>
}
export declare const AES: AESUtils
