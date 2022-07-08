import * as moment from 'moment'
import { Moment } from 'moment'
import * as _ from 'lodash'
import { a2b, b2a, b64Url2ua, string2ua, ua2b64Url, ua2hex, ua2string } from '../utils/binary-utils'
import { pack } from '../utils/asn1-packer'
import { parseAsn1 } from '../utils/asn1-parser'

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

  jwk2pkcs8(jwk: any): string {
    return pack([
      0x30,
      [
        [0x02, '00'],
        [0x30, [[0x06, '2a864886f70d010101'], [0x05]]],
        [
          0x04,
          [
            [
              0x30,
              [
                [0x02, '00'],
                [0x02, ua2hex(b64Url2ua(jwk.n))],
                [0x02, ua2hex(b64Url2ua(jwk.e))],
                [0x02, ua2hex(b64Url2ua(jwk.d))],
                [0x02, ua2hex(b64Url2ua(jwk.p))],
                [0x02, ua2hex(b64Url2ua(jwk.q))],
                [0x02, ua2hex(b64Url2ua(jwk.dp))],
                [0x02, ua2hex(b64Url2ua(jwk.dq))],
                [0x02, ua2hex(b64Url2ua(jwk.qi))],
              ],
            ],
          ],
        ],
      ],
    ])
  }

  jwk2pkcs1(jwk: any): string {
    return pack([
      0x30,
      [
        [0x02, '00'],
        [0x02, ua2hex(b64Url2ua(jwk.n))],
        [0x02, ua2hex(b64Url2ua(jwk.e))],
        [0x02, ua2hex(b64Url2ua(jwk.d))],
        [0x02, ua2hex(b64Url2ua(jwk.p))],
        [0x02, ua2hex(b64Url2ua(jwk.q))],
        [0x02, ua2hex(b64Url2ua(jwk.dp))],
        [0x02, ua2hex(b64Url2ua(jwk.dq))],
        [0x02, ua2hex(b64Url2ua(jwk.qi))],
      ],
    ])
  }

  jwk2spki(jwk: any): string {
    return pack([
      0x30,
      [
        [0x30, [[0x06, '2a864886f70d010101'], [0x05]]],
        [
          0x03,
          [
            [
              0x30,
              [
                [0x02, ua2hex(b64Url2ua(jwk.n))],
                [0x02, ua2hex(b64Url2ua(jwk.e))],
              ],
            ],
          ],
        ],
      ],
    ])
  }

  spkiToJwk(buf: Uint8Array): { kty: string; alg: string; n: string; e: string; ext: boolean } {
    const asn1 = parseAsn1(new Uint8Array(buf))

    var modulus: Uint8Array | undefined = undefined
    var exponent: Uint8Array | undefined = undefined
    if (
      asn1.type === 0x30 &&
      asn1.children?.[0]?.type === 0x30 &&
      asn1.children?.[0]?.children?.[0]?.type === 0x06 &&
      ua2hex(asn1.children?.[0]?.children?.[0]?.value ?? new Uint8Array()) === '2a864886f70d010101'
    ) {
      modulus = asn1.children?.[1]?.children?.[0]?.children?.[0]?.value
      exponent = asn1.children?.[1]?.children?.[0]?.children?.[1]?.value
    } else if (asn1.type === 0x30 && asn1.children?.[0]?.type === 0x02 && asn1.children?.[1]?.type === 0x02) {
      modulus = asn1.children?.[0]?.value
      exponent = asn1.children?.[1]?.value
    }

    if (!modulus || !exponent) {
      throw new Error('Invalid spki format')
    }
    return {
      kty: 'RSA',
      alg: 'RSA-OAEP',
      ext: true,
      n: ua2b64Url(this.minimalRep(modulus)),
      e: ua2b64Url(this.minimalRep(exponent)),
    }
  }

  pkcs8ToJwk(buf: Uint8Array | ArrayBuffer) {
    const parsed = parseAsn1(new Uint8Array(buf))
    const seq =
      parsed.children?.length === 3 && parsed.children[2].type === 0x04 && parsed.children[2].children?.length === 1
        ? parsed.children[2].children[0]
        : parsed
    return {
      kty: 'RSA',
      n: ua2b64Url(this.minimalRep(seq.children![1].value as Uint8Array)),
      e: ua2b64Url(this.minimalRep(seq.children![2].value as Uint8Array)),
      d: ua2b64Url(this.minimalRep(seq.children![3].value as Uint8Array)),
      p: ua2b64Url(this.minimalRep(seq.children![4].value as Uint8Array)),
      q: ua2b64Url(this.minimalRep(seq.children![5].value as Uint8Array)),
      dp: ua2b64Url(this.minimalRep(seq.children![6].value as Uint8Array)),
      dq: ua2b64Url(this.minimalRep(seq.children![7].value as Uint8Array)),
      qi: ua2b64Url(this.minimalRep(seq.children![8].value as Uint8Array)),
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
