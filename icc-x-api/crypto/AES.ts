import { utils } from "./utils"
import { debuglog } from "util"
import { ua2hex } from "../utils/binary-utils"

export class AESUtils {
  /********* AES Config **********/
  ivLength = 16
  aesAlgorithmEncryptName = "AES-CBC"

  aesKeyGenParams = {
    name: "AES-CBC",
    length: 256
  }
  private crypto: Crypto
  private _debug: boolean

  set debug(value: boolean) {
    this._debug = value
  }

  constructor(
    crypto: Crypto = typeof window !== "undefined"
      ? window.crypto
      : typeof self !== "undefined"
        ? self.crypto
        : ({} as Crypto)
  ) {
    this.crypto = crypto
    this._debug = false
  }

  encrypt(cryptoKey: CryptoKey, plainData: ArrayBuffer | Uint8Array, rawKey: string = "<NA>") {
    return new Promise((resolve: (value: ArrayBuffer) => any, reject: (reason: any) => any) => {
      if (plainData instanceof Uint8Array) {
        const buffer = plainData.buffer
        plainData = (buffer.byteLength > plainData.byteLength
          ? buffer.slice(0, plainData.byteLength)
          : buffer) as ArrayBuffer
      }
      const aesAlgorithmEncrypt = {
        name: this.aesAlgorithmEncryptName,
        iv: this.generateIV(this.ivLength)
      }
      this._debug && console.log(`encrypt ${plainData} with ${rawKey}`)
      this.crypto.subtle
        .encrypt(
          {
            ...aesAlgorithmEncrypt
          } /* some ill behaved implementations change the values in place */,
          cryptoKey,
          plainData
        )
        .then(
          cipherData =>
            resolve(utils.appendBuffer(aesAlgorithmEncrypt.iv!.buffer! as ArrayBuffer, cipherData)),
          err => reject("AES encryption failed: " + err)
        )
    })
  }

  /**
   *
   * @param cryptoKey (CryptoKey)
   * @param encryptedData (ArrayBuffer)
   * @param rawKey
   * @returns {Promise} will be ArrayBuffer
   */
  decrypt(cryptoKey: CryptoKey, encryptedData: ArrayBuffer | Uint8Array, rawKey: string = "<NA>") {
    return new Promise((resolve: (value: ArrayBuffer) => any, reject: (reason: any) => any) => {
      if (!cryptoKey) {
        return reject("No crypto key provided for decryption")
      }
      if (encryptedData instanceof ArrayBuffer) {
        var encryptedDataUnit8 = new Uint8Array(encryptedData)
      } else {
        var encryptedDataUnit8 = encryptedData
      }
      const aesAlgorithmEncrypt = {
        name: this.aesAlgorithmEncryptName,
        iv: encryptedDataUnit8.subarray(0, this.ivLength)

        /*
    * IF THIS BIT OF CODE PRODUCES A DOMEXCEPTION CODE 0 ERROR, IT MIGHT BE RELATED TO THIS:
    *
    * NOTOK:
    * if (!hcparty.hcPartyKeys && !hcparty.hcPartyKeys[hcpartyId] && hcparty.hcPartyKeys[hcpartyId].length !== 2) {
    *   throw 'No hcPartyKey for this Healthcare party(' + hcpartyId + ').';
    * }
    * var delegateHcPartyKey = hcparty.hcPartyKeys[hcpartyId][1];
    *
    * SHOULD BE:
    * var delegatorId = patient.delegations[hcpartyId][0].owner;
    * if (!hcparty.hcPartyKeys && !hcparty.hcPartyKeys[delegatorId] && hcparty.hcPartyKeys[delegatorId].length !== 2) {
    *   throw 'No hcPartyKey for this Healthcare party(' + delegatorId + ').';
    * }
    * var delegateHcPartyKey = hcparty.hcPartyKeys[delegatorId][1];
    */
      }
      this._debug && console.log(`decrypt with ${rawKey}`)
      this.crypto.subtle
        .decrypt(
          aesAlgorithmEncrypt,
          cryptoKey,
          encryptedDataUnit8.subarray(this.ivLength, encryptedDataUnit8.length)
        )
        .then(resolve, err => {
          reject("AES decryption failed: " + err)
        })
    })
  }

  // generate an AES key
  // noinspection JSUnusedGlobalSymbols
  /**
   *
   * @param toHex boolean, if true, it returns hex String
   * @returns {Promise} either Hex string or CryptoKey
   */
  generateCryptoKey(toHex: boolean) {
    return new Promise(
      (resolve: (value: CryptoKey | string) => any, reject: (reason: any) => any) => {
        const extractable = true
        const keyUsages = ["decrypt", "encrypt"]
        if (toHex === undefined || !toHex) {
          return this.crypto.subtle
            .generateKey(this.aesKeyGenParams, extractable, keyUsages)
            .then(resolve, reject)
        } else {
          return this.crypto.subtle
            .generateKey(this.aesKeyGenParams, extractable, keyUsages)
            .then(k => this.exportKey(k, "raw"), reject)
            .then(raw => resolve(ua2hex(raw)), reject)
        }
      }
    )
  }

  // noinspection JSMethodCanBeStatic
  generateIV(ivByteLength: number) {
    return new Uint8Array(this.crypto.getRandomValues(new Uint8Array(ivByteLength)))
  }

  /**
   * This function return a promise which will be the key Format will be either 'raw' or 'jwk'.
   * JWK: Json Web key (ref. http://tools.ietf.org/html/draft-ietf-jose-json-web-key-11)
   *
   * @param cryptoKey CryptoKey
   * @param format will be 'raw' or 'jwk'
   * @returns {Promise} will the AES Key
   */
  exportKey(cryptoKey: CryptoKey, format: string) {
    return new Promise(
      (resolve: (value: ArrayBuffer | JsonWebKey) => any, reject: (reason: any) => any) => {
        return this.crypto.subtle.exportKey(format, cryptoKey).then(resolve, reject)
      }
    )
  }

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
  importKey(format: string, aesKey: JsonWebKey | ArrayBuffer | Uint8Array) {
    return new Promise((resolve: (value: CryptoKey) => any, reject: (reason: any) => any) => {
      var extractable = true
      var keyUsages = ["decrypt", "encrypt"]
      return this.crypto.subtle
        .importKey(format, aesKey, this.aesKeyGenParams, extractable, keyUsages)
        .then(resolve, reject)
    })
  }
}

export const AES = new AESUtils()
