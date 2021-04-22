import * as base64js from 'base64-js'
import * as moment from 'moment'
import { Moment } from 'moment'
import * as _ from 'lodash'
import { a2b, b2a, ua2b64Url, hex2ua, string2ua, ua2b64, ua2hex, ua2string, b64Url2ua, b64_2ua } from '../utils/binary-utils'
import { ASN1, Stream } from '../utils/asn1'

export class UtilsClass {
  constructor() {}

  notConcurrent<T>(concurrencyMap: { [key: string]: PromiseLike<T> }, key: string, proc: () => PromiseLike<T>): PromiseLike<T> {
    const inFlight = concurrencyMap[key]
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

  spkiToJwk(buf: Uint8Array): { kty: string; alg: string; n: string; e: string; ext: boolean } {
    const pubkeyAsn1 = ASN1.decode(new Stream(buf, 0))
    //Case PKCS#8
    //16
    //  16
    //    06
    //    05
    //--03
    //----16
    //------2
    //------2
    let modulusRaw: ASN1 | undefined = undefined
    let exponentRaw: ASN1 | undefined = undefined

    if (pubkeyAsn1.tag.tagNumber === 16 && pubkeyAsn1.sub[0].tag.tagNumber === 16 && pubkeyAsn1.sub[0].sub[0].tag.tagNumber === 6) {
      const oidRaw = pubkeyAsn1.sub[0].sub[0]
      const oidStart = oidRaw.header + oidRaw.stream.pos
      const oid = oidRaw.stream.parseOID(oidStart, oidStart + oidRaw.length, 32)

      if (oid === '1.2.840.113549.1.1.1') {
        modulusRaw = pubkeyAsn1.sub[1].sub[0].sub[0]
        exponentRaw = pubkeyAsn1.sub[1].sub[0].sub[1]
      }
    } else {
      if (pubkeyAsn1.tag.tagNumber === 16 && pubkeyAsn1.sub[0].tag.tagNumber === 2 && pubkeyAsn1.sub[1].tag.tagNumber === 2) {
        modulusRaw = pubkeyAsn1.sub[0]
        exponentRaw = pubkeyAsn1.sub[1]
      }
    }

    if (!modulusRaw || !exponentRaw) {
      throw new Error('Invalid spki format')
    }

    const modulusStart = modulusRaw.header + modulusRaw.stream.pos + 1
    const modulusEnd = modulusRaw.length + modulusRaw.stream.pos + modulusRaw.header
    const modulusHex = modulusRaw.stream.hexDump(modulusStart, modulusEnd, true)
    const modulus = hex2ua(modulusHex)
    const exponentStart = exponentRaw.header + exponentRaw.stream.pos
    const exponentEnd = exponentRaw.length + exponentRaw.stream.pos + exponentRaw.header
    const exponentHex = exponentRaw.stream.hexDump(exponentStart, exponentEnd, true)
    const exponent = hex2ua(exponentHex)

    return {
      kty: 'RSA',
      alg: 'RSA-OAEP',
      ext: true,
      n: ua2b64Url(this.minimalRep(modulus)),
      e: ua2b64Url(this.minimalRep(exponent)),
    }
  }

  pkcs8ToJwk(buff: Uint8Array | ArrayBuffer) {
    let buf = new Uint8Array(buff)
    let hex = ua2hex(buf)
    if (!hex.startsWith('3082') || !hex.substr(8).startsWith('0201000282010100')) {
      hex = hex.substr(52)
      buf = hex2ua(hex)
    }
    const key: any = {}
    let offset = buf[1] & 0x80 ? buf[1] - 0x80 + 5 : 7

    function read() {
      let s = buf[offset + 1]

      if (s & 0x80) {
        const n = s - 0x80
        s = n === 2 ? 256 * buf[offset + 2] + buf[offset + 3] : buf[offset + 2]
        offset += n
      }

      offset += 2

      const b = buf.slice(offset, offset + s)
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
      kty: 'RSA',
      n: ua2b64Url(this.minimalRep(key.modulus)),
      e: ua2b64Url(this.minimalRep(key.publicExponent)),
      d: ua2b64Url(this.minimalRep(key.privateExponent)),
      p: ua2b64Url(this.minimalRep(key.prime1)),
      q: ua2b64Url(this.minimalRep(key.prime2)),
      dp: ua2b64Url(this.minimalRep(key.exponent1)),
      dq: ua2b64Url(this.minimalRep(key.exponent2)),
      qi: ua2b64Url(this.minimalRep(key.coefficient)),
    }
  }

  minimalRep(b: Uint8Array) {
    let i = 0
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
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
    tmp.set(new Uint8Array(buffer1), 0)
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength)
    return tmp.buffer as ArrayBuffer
  }

  //Convenience methods for dates management
  after(d1: number, d2: number): boolean {
    return d1 === null || d2 === null || d1 === undefined || d2 === undefined || this.moment(d1)!.isAfter(this.moment(d2)!)
  }

  before(d1: number, d2: number): boolean {
    return d1 === null || d2 === null || d1 === undefined || d2 === undefined || this.moment(d1)!.isBefore(this.moment(d2)!)
  }

  moment(epochOrLongCalendar: number): Moment | null {
    if (!epochOrLongCalendar && epochOrLongCalendar !== 0) {
      return null
    }
    if (epochOrLongCalendar >= 18000101 && epochOrLongCalendar < 25400000) {
      return moment('' + epochOrLongCalendar, 'YYYYMMDD')
    } else if (epochOrLongCalendar >= 18000101000000) {
      return moment('' + epochOrLongCalendar, 'YYYYMMDDHHmmss')
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
  async crypt(obj: any, cryptor: (obj: { [key: string]: string }) => Promise<ArrayBuffer>, keys: Array<string>) {
    const subObj = _.pick(
      obj,
      keys.filter((k) => !k.includes('*'))
    )
    obj.encryptedSelf = b2a(ua2string(await cryptor(subObj)))
    Object.keys(subObj).forEach((k) => delete obj[k])

    await keys
      .filter((k) => k.includes('*'))
      .reduce(async (prev: Promise<void>, k: any) => {
        await prev
        const k1 = k.split('.*.')[0]
        const k2 = k.substr(k1.length + 3)

        const mapped = await Promise.all((_.get(obj, k1) || []).map((so: any) => this.crypt(so, cryptor, k2.startsWith('[') ? JSON.parse(k2) : [k2])))
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
          .filter((o) => typeof o === 'object' && o !== null)
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
