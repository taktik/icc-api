const textDecoder = TextDecoder ? new TextDecoder() : null
const textEncoder = TextEncoder ? new TextEncoder() : null

export function b2a(a: string): string {
  if (Buffer) {
    const buf = Buffer.from(a, "latin1")
    return buf.toString("base64")
  }
  if (typeof btoa !== "undefined") {
    return btoa(a)
  }
  throw new Error("Unsupported operation b2a")
}

export function a2b(s: string): string {
  if (Buffer) {
    const buf = new Buffer(s, "base64")
    return buf.toString("latin1")
  }
  if (typeof atob !== "undefined") {
    return atob(s)
  }
  throw new Error("Unsupported operation a2b")
}

export function utf8_2ua(str: string): Uint8Array {
  if (textEncoder) {
    return textEncoder.encode(str)
  }

  const utf8 = new Uint8Array(4 * str.length)
  let j = 0
  for (var i = 0; i < str.length; i++) {
    var charcode = str.charCodeAt(i)
    if (charcode < 0x80) {
      utf8.set([charcode], j++)
    } else if (charcode < 0x800) {
      utf8.set([0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f)], j)
      j += 2
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.set(
        [0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f)],
        j
      )
      j += 3
    } else {
      i++
      // UTF-16 encodes 0x10000-0x10FFFF by
      // subtracting 0x10000 and splitting the
      // 20 bits of 0x0-0xFFFFF into two halves
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
      utf8.set(
        [
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        ],
        j
      )
      j += 4
    }
  }
  return utf8.subarray(0, j)
}

/**
 * Uint8Array/ArrayBuffer to utf-8 strring
 * @param _ua {Uint8Array} or ArrayBuffer
 * @returns {String} a UTF-8 encoded string
 */
export function ua2utf8(_ua: Uint8Array | ArrayBuffer): string {
  if (textDecoder) {
    // if _ua is undefined, imitate the JS implementation below which returns an empty string
    return _ua ? textDecoder.decode(_ua) : ""
  }

  var out, i, len, c, u
  var char2, char3, char4

  // avoid applying the Uint8Array constructor: on ArrayBuffer it creates a
  // view but on Uint8Array it creates a copy
  const array = ArrayBuffer.isView(_ua) ? _ua : new Uint8Array(_ua)

  out = ""
  len = array.length || array.byteLength
  i = 0
  while (i < len) {
    c = array[i++]
    switch (c >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c)
        break
      case 12:
      case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++]
        out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f))
        break
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++]
        char3 = array[i++]
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
        )
        break
      case 15:
        // 1111 xxxx  10xx xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++]
        char3 = array[i++]
        char4 = array[i++]
        u =
          ((c & 0x07) << 18) |
          ((char2 & 0x3f) << 12) |
          ((char3 & 0x3f) << 6) |
          (((char4 & 0x3f) << 0) - 0x10000)
        out += String.fromCharCode(0xd800 + (u >> 10))
        out += String.fromCharCode(0xdc00 + (u & 1023))
        break
    }
  }

  return out
}

export function hex2ua(s: string): Uint8Array {
  const ua = new Uint8Array(s.length / 2)
  s = s.toLowerCase()
  for (var i = 0; i < s.length; i += 2) {
    ua[i / 2] =
      (s.charCodeAt(i) < 58 ? s.charCodeAt(i) - 48 : s.charCodeAt(i) - 87) * 16 +
      (s.charCodeAt(i + 1) < 58 ? s.charCodeAt(i + 1) - 48 : s.charCodeAt(i + 1) - 87)
  }
  return ua
}

/**
 * Uint8Array/ArrayBuffer to hex String
 *
 * @param _ua {Uint8Array} or ArrayBuffer
 * @returns {String} Hex String
 */
export function ua2hex(_ua: Uint8Array | ArrayBuffer): string {
  let s = ""
  const ua = new Uint8Array(_ua)
  for (var i = 0; i < ua.length; i++) {
    var hhb = (ua[i] & 0xf0) >> 4
    var lhb = ua[i] & 0x0f
    s += String.fromCharCode(hhb > 9 ? hhb + 87 : hhb + 48)
    s += String.fromCharCode(lhb > 9 ? lhb + 87 : lhb + 48)
  }

  return s
}

export function string2ua(s: string): Uint8Array {
  const ua = new Uint8Array(s.length)
  for (var i = 0; i < s.length; i++) {
    ua[i] = s.charCodeAt(i) & 0xff
  }
  return ua
}

export function string2ab(s: string): ArrayBuffer {
  return ua2ab(string2ua(s))
}

export function ua2ab(ua: Uint8Array): ArrayBuffer {
  const buffer = ua.buffer
  return (buffer.byteLength > ua.byteLength
    ? buffer.slice(0, ua.byteLength)
    : buffer) as ArrayBuffer
}

export function b64_2ab(s: string): ArrayBuffer {
  return ua2ab(string2ua(a2b(s)))
}

export function b64_2ua(s: string): Uint8Array {
  return string2ua(a2b(s))
}

export function ua2b64(_ua: Uint8Array | ArrayBuffer): string {
  return b2a(ua2string(_ua))
}

export function b64_2uas(s: string): Array<Uint8Array> {
  var sliceSize = 1024
  var byteCharacters = a2b(s)
  var bytesLength = byteCharacters.length
  var slicesCount = Math.ceil(bytesLength / sliceSize)
  var byteArrays = new Array(slicesCount)

  for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
    var begin = sliceIndex * sliceSize
    var end = Math.min(begin + sliceSize, bytesLength)

    var bytes = new Array(end - begin)
    for (var offset = begin, i = 0; offset < end; ++i, ++offset) {
      bytes[i] = byteCharacters[offset].charCodeAt(0)
    }
    byteArrays[sliceIndex] = new Uint8Array(bytes)
  }
  return byteArrays
}

/**
 * ArrayBuffer to String - resilient to large ArrayBuffers.
 *
 * @param _ua
 * @returns {string}
 */
export function ua2string(_ua: Uint8Array | ArrayBuffer): string {
  var str = ""
  var ab = new Uint8Array(_ua)
  var abLen = ab.length
  var CHUNK_SIZE = Math.pow(2, 8)
  var offset, len, subab
  for (offset = 0; offset < abLen; offset += CHUNK_SIZE) {
    len = Math.min(CHUNK_SIZE, abLen - offset)
    subab = ab.subarray(offset, offset + len)
    str += String.fromCharCode.apply(null, subab as any)
  }
  return str
}

export function ua2b64Url(ua: Uint8Array | ArrayBuffer): string {
  return ua2b64(ua)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

export function b64Url2ua(ua: string): ArrayBuffer {
  return b64_2ua(
    ua
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/=/g, "") + (ua.length % 4 === 3 ? "=" : ua.length % 4 === 2 ? "==" : "")
  )
}

export function hex2string(hexStr: string): string {
  return ua2string(hex2ua(hexStr))
}

export function string2hex(text: string): string {
  return ua2hex(string2ua(text))
}
