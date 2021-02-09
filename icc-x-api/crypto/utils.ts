import * as base64js from "base64-js"
import * as moment from "moment"
import { Moment } from "moment"
import * as _ from "lodash"
import { a2b, b2a, base64url, hex2ua, string2ua, ua2hex, ua2string } from "../utils/binary-utils"

export class UtilsClass {
  constructor() {}

  notConcurrent<T>(
    concurrencyMap: { [key: string]: PromiseLike<T> },
    key: string,
    proc: () => PromiseLike<T>
  ): PromiseLike<T> {
    let inFlight = concurrencyMap[key]
    if (!inFlight) {
      return (concurrencyMap[key] = (async () => {
        try {
          return await proc()
        } finally {
          delete concurrencyMap[key]
        }
      })())
    } else {
      return concurrencyMap[key].then(() => this.notConcurrent(concurrencyMap, key, proc))
    }
  }

  spkiToJwk(buf: Uint8Array): { kty: string; n: string; e: string } {
    var hex = ua2hex(buf)
    if (!hex.startsWith("3082") || !hex.substr(8).startsWith("0282010100")) {
      hex = hex.substr(48)
      buf = hex2ua(hex)
    }
    var key: any = {}
    var offset = buf[1] & 0x80 ? buf[1] - 0x80 + 2 : 2

    function read() {
      var s = buf[offset + 1]

      if (s & 0x80) {
        var n = s - 0x80
        s = n === 2 ? 256 * buf[offset + 2] + buf[offset + 3] : buf[offset + 2]
        offset += n
      }

      offset += 2

      var b = buf.slice(offset, offset + s)
      offset += s
      return b
    }

    key.modulus = read()
    key.publicExponent = read()

    return {
      kty: "RSA",
      n: base64url(this.minimalRep(key.modulus)),
      e: base64url(this.minimalRep(key.publicExponent))
    }
  }

  pkcs8ToJwk(buff: Uint8Array | ArrayBuffer) {
    let buf = new Uint8Array(buff)
    var hex = ua2hex(buf)
    if (!hex.startsWith("3082") || !hex.substr(8).startsWith("0201000282010100")) {
      hex = hex.substr(52)
      buf = hex2ua(hex)
    }
    var key: any = {}
    var offset = buf[1] & 0x80 ? buf[1] - 0x80 + 5 : 7

    function read() {
      var s = buf[offset + 1]

      if (s & 0x80) {
        var n = s - 0x80
        s = n === 2 ? 256 * buf[offset + 2] + buf[offset + 3] : buf[offset + 2]
        offset += n
      }

      offset += 2

      var b = buf.slice(offset, offset + s)
      offset += s
      return b
    }

    key.modulus = read()
    key.publicExponent = read()
    key.privateExponent = read()
    key.prime1 = read()
    key.prime2 = read()
    key.exponent1 = read()
    key.exponent2 = read()
    key.coefficient = read()

    return {
      kty: "RSA",
      n: base64url(this.minimalRep(key.modulus)),
      e: base64url(this.minimalRep(key.publicExponent)),
      d: base64url(this.minimalRep(key.privateExponent)),
      p: base64url(this.minimalRep(key.prime1)),
      q: base64url(this.minimalRep(key.prime2)),
      dp: base64url(this.minimalRep(key.exponent1)),
      dq: base64url(this.minimalRep(key.exponent2)),
      qi: base64url(this.minimalRep(key.coefficient))
    }
  }

  minimalRep(b: Uint8Array) {
    var i = 0
    while (b[i] === 0) {
      i++
    }
    return b.slice(i)
  }

  /**
   * Provide a view over the given Uint8Array where any trailing null bytes at
   * the end are truncated.
   *
   * This can be used to ignore null bytes at the end of a padded UTF-8 string
   * without needing to copy that string, assuming code point U+0000 is encoded
   * in one null byte according to standards rather than in a multi-byte
   * overlong form.
   */
  truncateTrailingNulls(a: Uint8Array) {
    let end = a.byteLength - 1
    while (a[end] === 0 && end >= 0) {
      end--
    }
    // end is now either the last non-null position in a or -1; in the latter
    // case the returned array will have length 0.
    return a.subarray(0, end + 1)
  }

  /**
   *
   * @param buffer1 {Uint8Array}
   * @param buffer2{ Uint8Array}
   * @returns {ArrayBuffer}
   */
  appendBuffer(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
    tmp.set(new Uint8Array(buffer1), 0)
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength)
    return tmp.buffer as ArrayBuffer
  }

  //Convenience methods for dates management
  after(d1: number, d2: number): boolean {
    return (
      d1 === null ||
      d2 === null ||
      d1 === undefined ||
      d2 === undefined ||
      this.moment(d1)!.isAfter(this.moment(d2)!)
    )
  }

  before(d1: number, d2: number): boolean {
    return (
      d1 === null ||
      d2 === null ||
      d1 === undefined ||
      d2 === undefined ||
      this.moment(d1)!.isBefore(this.moment(d2)!)
    )
  }

  moment(epochOrLongCalendar: number): Moment | null {
    if (!epochOrLongCalendar && epochOrLongCalendar !== 0) {
      return null
    }
    if (epochOrLongCalendar >= 18000101 && epochOrLongCalendar < 25400000) {
      return moment("" + epochOrLongCalendar, "YYYYMMDD")
    } else if (epochOrLongCalendar >= 18000101000000) {
      return moment("" + epochOrLongCalendar, "YYYYMMDDHHmmss")
    } else {
      return moment(epochOrLongCalendar)
    }
  }

  /**
   * Encrypt object graph recursively
   *
   * @param obj the object to encrypt
   * @param cryptor the cryptor function (returns a promise)
   * @param keys the keys to be crypted: ex for a Patient ['note', 'addresses.*.["street", "houseNumber", "telecoms.*.telecomNumber"]']
   */
  async crypt(
    obj: any,
    cryptor: (obj: { [key: string]: string }) => Promise<ArrayBuffer>,
    keys: Array<string>
  ) {
    const subObj = _.pick(obj, keys.filter(k => !k.includes("*")))
    obj.encryptedSelf = b2a(ua2string(await cryptor(subObj)))
    Object.keys(subObj).forEach(k => delete obj[k])

    await keys.filter(k => k.includes("*")).reduce(async (prev: Promise<void>, k: any) => {
      await prev
      const k1 = k.split(".*.")[0]
      const k2 = k.substr(k1.length + 3)

      const mapped = await Promise.all(
        (_.get(obj, k1) || []).map((so: any) =>
          this.crypt(so, cryptor, k2.startsWith("[") ? JSON.parse(k2) : [k2])
        )
      )
      _.set(obj, k1, mapped)
    }, Promise.resolve())

    return obj
  }

  /**
   * Decrypt object graph recursively
   *
   * @param obj the object to encrypt
   * @param decryptor the decryptor function (returns a promise)
   */
  async decrypt(obj: any, decryptor: (obj: Uint8Array) => Promise<{ [key: string]: string }>) {
    await Object.keys(obj).reduce(async (prev: Promise<void>, k: any) => {
      await prev
      if (Array.isArray(obj[k])) {
        await (obj[k] as Array<any>)
          .filter(o => typeof o === "object" && o !== null)
          .reduce(async (prev: Promise<void>, so: any) => {
            await prev
            await this.decrypt(so, decryptor)
          }, Promise.resolve())
      }
    }, Promise.resolve())
    if (obj.encryptedSelf) {
      Object.assign(obj, await decryptor(string2ua(a2b(obj.encryptedSelf))))
    }
    return obj
  }
}

export const utils = new UtilsClass()
