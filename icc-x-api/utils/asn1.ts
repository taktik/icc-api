// ASN.1 JavaScript decoder
// Copyright (c) 2008-2014 Lapo Luchini <lapo@lapo.it>

// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

export class Int10 {
  static max: number = 10000000000000 // biggest integer that can still fit 2^53 when multiplied by 256
  private readonly buf: number[]

  constructor(value: number = 0) {
    this.buf = [+value || 0]
  }

  mulAdd(m: number, c: number) {
    // assert(m <= 256)
    var b = this.buf,
      l = b.length,
      i,
      t
    for (i = 0; i < l; ++i) {
      t = b[i] * m + c
      if (t < Int10.max) c = 0
      else {
        c = 0 | (t / Int10.max)
        t -= c * Int10.max
      }
      b[i] = t
    }
    if (c > 0) b[i] = c
  }

  toString(base: number = 10) {
    if ((base || 10) != 10) throw "only base 10 is supported"
    var b = this.buf,
      s = b[b.length - 1].toString()
    for (var i = b.length - 2; i >= 0; --i) s += (Int10.max + b[i]).toString().substring(1)
    return s
  }

  valueOf() {
    var b = this.buf,
      v = 0
    for (var i = b.length - 1; i >= 0; --i) v = v * Int10.max + b[i]
    return v
  }

  simplify(): number | Int10 {
    var b = this.buf
    return b.length == 1 ? b[0] : this
  }
}

const ellipsis: string = "\u2026"
const reTimeS: RegExp = /^(\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/
const reTimeL: RegExp = /^(\d\d\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/
const hexDigits = "0123456789abcdef"

function stringCut(str: string, len: number) {
  if (str.length > len) {
    str = str.substring(0, len) + ellipsis
  }
  return str
}

export class Stream {
  enc: Uint8Array
  pos: number

  constructor(enc: Uint8Array, pos: number) {
    this.enc = enc
    this.pos = pos
  }

  get(pos?: number) {
    if (pos === undefined) pos = this.pos++
    if (pos >= this.enc.byteLength)
      throw "Requesting byte offset " + pos + " on a stream of length " + this.enc.length
    return this.enc[pos]
  }

  hexByte(b: number) {
    return hexDigits.charAt((b >> 4) & 0xf) + hexDigits.charAt(b & 0xf)
  }

  hexDump(start: number, end: number, raw: boolean = false) {
    var s = ""
    for (var i = start; i < end; ++i) {
      s += this.hexByte(this.get(i))
      if (!raw)
        switch (i & 0xf) {
          case 0x7:
            s += "  "
            break
          case 0xf:
            s += "\n"
            break
          default:
            s += " "
        }
    }
    return s
  }

  isASCII(start: number, end: number) {
    for (var i = start; i < end; ++i) {
      var c = this.get(i)
      if (c < 32 || c > 176) return false
    }
    return true
  }

  parseStringISO(start: number, end: number) {
    var s = ""
    for (var i = start; i < end; ++i) s += String.fromCharCode(this.get(i))
    return s
  }

  parseStringUTF(start: number, end: number) {
    var s = ""
    for (var i = start; i < end; ) {
      var c = this.get(i++)
      if (c < 128) s += String.fromCharCode(c)
      else if (c > 191 && c < 224)
        s += String.fromCharCode(((c & 0x1f) << 6) | (this.get(i++) & 0x3f))
      else
        s += String.fromCharCode(
          ((c & 0x0f) << 12) | ((this.get(i++) & 0x3f) << 6) | (this.get(i++) & 0x3f)
        )
    }
    return s
  }

  parseStringBMP(start: number, end: number) {
    var str = "",
      hi,
      lo
    for (var i = start; i < end; ) {
      hi = this.get(i++)
      lo = this.get(i++)
      str += String.fromCharCode((hi << 8) | lo)
    }
    return str
  }

  parseTime(start: number, end: number, shortYear: boolean) {
    var s = this.parseStringISO(start, end)
    const m = (shortYear ? reTimeS : reTimeL).exec(s)
    if (!m) return "Unrecognized time: " + s
    if (shortYear) {
      // to avoid querying the timer, use the fixed range [1970, 2069]
      // it will conform with ITU X.400 [-10, +40] sliding window until 2030
      const year = +m[1]
      m[1] = "" + (year < 70 ? 2000 : 1900)
    }
    s = m[1] + "-" + m[2] + "-" + m[3] + " " + m[4]
    if (m[5]) {
      s += ":" + m[5]
      if (m[6]) {
        s += ":" + m[6]
        if (m[7]) s += "." + m[7]
      }
    }
    if (m[8]) {
      s += " UTC"
      if (m[8] != "Z") {
        s += m[8]
        if (m[9]) s += ":" + m[9]
      }
    }
    return s
  }

  parseInteger(start: number, end: number) {
    var v = this.get(start),
      neg = v > 127,
      pad = neg ? 255 : 0,
      len,
      s = ""
    // skip unuseful bits (not allowed in DER)
    while (v == pad && ++start < end) v = this.get(start)
    len = end - start
    if (len === 0) return neg ? -1 : 0
    // show bit length of huge integers
    if (len > 4) {
      let vv = v
      len <<= 3
      while (((vv ^ pad) & 0x80) == 0) {
        vv <<= 1
        --len
      }
      s = "(" + len + " bit)\n"
    }
    // decode the integer
    if (neg) v = v - 256
    var n = new Int10(v)
    for (var i = start + 1; i < end; ++i) n.mulAdd(256, this.get(i))
    return s + n.toString()
  }
  parseBitString(start: number, end: number, maxLength: number) {
    var unusedBit = this.get(start),
      lenBit = ((end - start - 1) << 3) - unusedBit,
      intro = "(" + lenBit + " bit)\n",
      s = ""
    for (var i = start + 1; i < end; ++i) {
      var b = this.get(i),
        skip = i == end - 1 ? unusedBit : 0
      for (var j = 7; j >= skip; --j) s += (b >> j) & 1 ? "1" : "0"
      if (s.length > maxLength) return intro + stringCut(s, maxLength)
    }
    return intro + s
  }

  parseOctetString(start: number, end: number, maxLength: number) {
    if (this.isASCII(start, end)) return stringCut(this.parseStringISO(start, end), maxLength)
    var len = end - start,
      s = "(" + len + " byte)\n"
    maxLength /= 2 // we work in bytes
    if (len > maxLength) end = start + maxLength
    for (var i = start; i < end; ++i) s += this.hexByte(this.get(i))
    if (len > maxLength) s += ellipsis
    return s
  }

  parseOID(start: number, end: number, maxLength: number) {
    var s = "",
      n = new Int10(),
      bits = 0
    for (var i = start; i < end; ++i) {
      var v = this.get(i)
      n.mulAdd(128, v & 0x7f)
      bits += 7
      if (!(v & 0x80)) {
        // finished
        if (s === "") {
          const num = n.simplify() as number
          var m = num < 80 ? (num < 40 ? 0 : 1) : 2
          s = m + "." + (num - m * 40)
        } else s += "." + n.toString()
        if (s.length > maxLength) return stringCut(s, maxLength)
        n = new Int10()
        bits = 0
      }
    }
    if (bits > 0) s += ".incomplete"
    return s
  }
}

class ASN1Tag {
  tagClass: number
  tagConstructed: boolean
  tagNumber: number

  constructor(stream: Stream) {
    var buf = stream.get()
    this.tagClass = buf >> 6
    this.tagConstructed = (buf & 0x20) !== 0
    this.tagNumber = buf & 0x1f
    if (this.tagNumber == 0x1f) {
      // long tag
      var n = new Int10()
      do {
        buf = stream.get()
        n.mulAdd(128, buf & 0x7f)
      } while (buf & 0x80)
      this.tagNumber = n.simplify() as number
    }
  }

  isUniversal() {
    return this.tagClass === 0x00
  }

  isEOC() {
    return this.tagClass === 0x00 && this.tagNumber === 0x00
  }
}

export class ASN1 {
  stream: Stream
  header: number
  length: number
  tag: ASN1Tag
  sub: ASN1[]

  constructor(stream: Stream, header: number, length: number, tag: ASN1Tag, sub: ASN1[] = []) {
    this.stream = stream
    this.header = header
    this.length = length
    this.tag = tag
    this.sub = sub
  }

  typeName() {
    switch (this.tag.tagClass) {
      case 0: // universal
        switch (this.tag.tagNumber) {
          case 0x00:
            return "EOC"
          case 0x01:
            return "BOOLEAN"
          case 0x02:
            return "INTEGER"
          case 0x03:
            return "BIT_STRING"
          case 0x04:
            return "OCTET_STRING"
          case 0x05:
            return "NULL"
          case 0x06:
            return "OBJECT_IDENTIFIER"
          case 0x07:
            return "ObjectDescriptor"
          case 0x08:
            return "EXTERNAL"
          case 0x09:
            return "REAL"
          case 0x0a:
            return "ENUMERATED"
          case 0x0b:
            return "EMBEDDED_PDV"
          case 0x0c:
            return "UTF8String"
          case 0x10:
            return "SEQUENCE"
          case 0x11:
            return "SET"
          case 0x12:
            return "NumericString"
          case 0x13:
            return "PrintableString" // ASCII subset
          case 0x14:
            return "TeletexString" // aka T61String
          case 0x15:
            return "VideotexString"
          case 0x16:
            return "IA5String" // ASCII
          case 0x17:
            return "UTCTime"
          case 0x18:
            return "GeneralizedTime"
          case 0x19:
            return "GraphicString"
          case 0x1a:
            return "VisibleString" // ASCII subset
          case 0x1b:
            return "GeneralString"
          case 0x1c:
            return "UniversalString"
          case 0x1e:
            return "BMPString"
        }
        return "Universal_" + this.tag.tagNumber.toString()
      case 1:
        return "Application_" + this.tag.tagNumber.toString()
      case 2:
        return "[" + this.tag.tagNumber.toString() + "]" // Context
      case 3:
        return "Private_" + this.tag.tagNumber.toString()
    }
  }

  content(maxLength: number) {
    // a preview of the content (intended for humans)
    if (this.tag === undefined) return null
    if (maxLength === undefined) maxLength = Infinity
    var content = this.posContent(),
      len = Math.abs(this.length)
    if (!this.tag.isUniversal()) {
      if (this.sub !== null) return "(" + this.sub.length + " elem)"
      return this.stream.parseOctetString(content, content + len, maxLength)
    }
    switch (this.tag.tagNumber) {
      case 0x01: // BOOLEAN
        return this.stream.get(content) === 0 ? "false" : "true"
      case 0x02: // INTEGER
        return this.stream.parseInteger(content, content + len)
      case 0x03: // BIT_STRING
        return this.sub
          ? "(" + this.sub.length + " elem)"
          : this.stream.parseBitString(content, content + len, maxLength)
      case 0x04: // OCTET_STRING
        return this.sub
          ? "(" + this.sub.length + " elem)"
          : this.stream.parseOctetString(content, content + len, maxLength)
      //case 0x05: // NULL
      case 0x06: // OBJECT_IDENTIFIER
        return this.stream.parseOID(content, content + len, maxLength)
      //case 0x07: // ObjectDescriptor
      //case 0x08: // EXTERNAL
      //case 0x09: // REAL
      //case 0x0A: // ENUMERATED
      //case 0x0B: // EMBEDDED_PDV
      case 0x10: // SEQUENCE
      case 0x11: // SET
        return "(" + this.sub.length + " elem)"
      case 0x0c: // UTF8String
        return stringCut(this.stream.parseStringUTF(content, content + len), maxLength)
      case 0x12: // NumericString
      case 0x13: // PrintableString
      case 0x14: // TeletexString
      case 0x15: // VideotexString
      case 0x16: // IA5String
      //case 0x19: // GraphicString
      case 0x1a: // VisibleString
        //case 0x1B: // GeneralString
        //case 0x1C: // UniversalString
        return stringCut(this.stream.parseStringISO(content, content + len), maxLength)
      case 0x1e: // BMPString
        return stringCut(this.stream.parseStringBMP(content, content + len), maxLength)
      case 0x17: // UTCTime
      case 0x18: // GeneralizedTime
        return this.stream.parseTime(content, content + len, this.tag.tagNumber == 0x17)
    }
    return null
  }

  toString() {
    return (
      this.typeName() +
      "@" +
      this.stream.pos +
      "[header:" +
      this.header +
      ",length:" +
      this.length +
      ",sub:" +
      (this.sub === null ? "null" : this.sub.length) +
      "]"
    )
  }

  toPrettyString(indent: string = "") {
    var s = indent + this.typeName() + " @" + this.stream.pos
    if (this.length >= 0) s += "+"
    s += this.length
    if (this.tag.tagConstructed) s += " (constructed)"
    else if (
      this.tag.isUniversal() &&
      (this.tag.tagNumber == 0x03 || this.tag.tagNumber == 0x04) &&
      this.sub !== null
    )
      s += " (encapsulates)"
    s += "\n"
    if (this.sub !== null) {
      indent += "  "
      for (var i = 0, max = this.sub.length; i < max; ++i) s += this.sub[i].toPrettyString(indent)
    }
    return s
  }

  posStart() {
    return this.stream.pos
  }

  posContent() {
    return this.stream.pos + this.header
  }

  posEnd() {
    return this.stream.pos + this.header + Math.abs(this.length)
  }

  toHexString() {
    return this.stream.hexDump(this.posStart(), this.posEnd(), true)
  }

  static decodeLength(stream: Stream) {
    var buf = stream.get(),
      len = buf & 0x7f
    if (len == buf) return len
    if (len > 6)
      // no reason to use Int10, as it would be a huge buffer anyways
      throw "Length over 48 bits not supported at position " + (stream.pos - 1)
    if (len === 0) return null // undefined
    buf = 0
    for (var i = 0; i < len; ++i) buf = buf * 256 + stream.get()
    return buf
  }

  static decode(stream: Stream) {
    var streamStart = new Stream(stream.enc, stream.pos),
      tag = new ASN1Tag(stream),
      len = ASN1.decodeLength(stream),
      start = stream.pos,
      header = start - streamStart.pos

    let sub: ASN1[] | null = null

    var getSub = function() {
      sub = []
      if (len !== null) {
        // definite length
        var end = start + len
        while (stream.pos < end) sub[sub.length] = ASN1.decode(stream)
        if (stream.pos != end)
          throw "Content size is not correct for container starting at offset " + start
      } else {
        // undefined length
        try {
          for (;;) {
            var s = ASN1.decode(stream)
            if (s.tag.isEOC()) break
            sub[sub.length] = s
          }
          len = start - stream.pos // undefined lengths are represented as negative values
        } catch (e) {
          throw "Exception while decoding undefined length content: " + e
        }
      }
    }
    if (tag.tagConstructed) {
      // must have valid content
      getSub()
    } else if (tag.isUniversal() && (tag.tagNumber == 0x03 || tag.tagNumber == 0x04)) {
      // sometimes BitString and OctetString are used to encapsulate ASN.1
      try {
        if (tag.tagNumber == 0x03)
          if (stream.get() != 0) throw "BIT STRINGs with unused bits cannot encapsulate."
        getSub()
        if (sub) {
          for (var i = 0; i < (sub as ASN1[]).length; ++i)
            if ((sub as ASN1[])[i].tag.isEOC()) throw "EOC is not supposed to be actual content."
        }
      } catch (e) {
        // but silently ignore when they don't
        sub = null
      }
    }
    if (sub === null) {
      if (len === null)
        throw "We can't skip over an invalid tag with undefined length at offset " + start
      stream.pos = start + Math.abs(len)
    }
    return new ASN1(streamStart, header, len!, tag, sub ? (sub! as ASN1[]) : undefined)
  }
}
