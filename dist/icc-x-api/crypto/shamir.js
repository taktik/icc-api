"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
class ShamirClass {
  constructor(
    crypto = typeof window !== "undefined"
      ? window.crypto
      : typeof self !== "undefined"
        ? self.crypto
        : {}
  ) {
    // Protected settings object
    this.config = {
      bits: 8,
      radix: 16,
      size: Math.pow(2, 8 /* config.bits */),
      max: Math.pow(2, 8 /* config.bits */) - 1,
      minBits: 3,
      maxBits: 16,
      bytesPerChar: 2,
      maxBytesPerChar: 6,
      // Primitive polynomials (in decimal form) for Galois Fields GF(2^n), for 2 <= n <= 30
      // The index of each term in the array corresponds to the n for that polynomial
      // i.e. to get the polynomial for n=16, use primitivePolynomials[16]
      primitivePolynomials: [
        null,
        null,
        1,
        3,
        3,
        5,
        3,
        3,
        29,
        17,
        9,
        5,
        83,
        27,
        43,
        3,
        45,
        9,
        39,
        39,
        9,
        5,
        3,
        33,
        27,
        9,
        71,
        39,
        9,
        5,
        83
      ],
      // warning for insecure PRNG
      warning:
        "WARNING:\nA secure random number generator was not found.\nUsing Math.random(), which is NOT cryptographically strong!",
      logs: [],
      exps: []
    }
    this.crypto = crypto
  }
  init() {
    const primitive = this.config.primitivePolynomials[this.config.bits]
    let x = 1
    for (var i = 0; i < this.config.size; i++) {
      this.config.exps[i] = x
      this.config.logs[x] = i
      x <<= 1
      if (x >= this.config.size) {
        x ^= primitive
        x &= this.config.max
      }
    }
  }
  // Splits a number string `bits`-length segments, after first
  // optionally zero-padding it to a length that is a multiple of `padLength.
  // Returns array of integers (each less than 2^bits-1), with each element
  // representing a `bits`-length segment of the input string from right to left,
  // i.e. parts[0] represents the right-most `bits`-length segment of the input string.
  split(str, padLength = 0) {
    if (padLength) {
      str = this.padLeft(str, padLength)
    }
    var parts = []
    for (var i = str.length; i > this.config.bits; i -= this.config.bits) {
      parts.push(parseInt(str.slice(i - this.config.bits, i), 2))
    }
    parts.push(parseInt(str.slice(0, i), 2))
    return parts
  }
  bin2hex(str) {
    var hex = "",
      num
    str = this.padLeft(str, 4)
    for (var i = str.length; i >= 4; i -= 4) {
      num = parseInt(str.slice(i - 4, i), 2)
      if (isNaN(num)) {
        throw new Error("Invalid binary character.")
      }
      hex = num.toString(16) + hex
    }
    return hex
  }
  hex2bin(str) {
    var bin = "",
      num
    for (var i = str.length - 1; i >= 0; i--) {
      num = parseInt(str[i], 16)
      if (isNaN(num)) {
        throw new Error("Invalid hex character.")
      }
      bin = this.padLeft(num.toString(2), 4) + bin
    }
    return bin
  }
  padLeft(str, bits = this.config.bits) {
    var missing = str.length % bits
    return (missing ? new Array(bits - missing + 1).join("0") : "") + str
  }
  random(bits) {
    const construct = (bits, arr, size) => {
      let str = "",
        i = 0
      const len = arr.length - 1
      while (i < len || str.length < bits) {
        str += this.padLeft(arr[i].toString(16), size)
        i++
      }
      str = str.substr(-bits / 4)
      return (str.match(/0/g) || []).length === str.length ? null : str
    }
    var elems = Math.ceil(bits / 32),
      str = null,
      arr = new Uint32Array(elems)
    while (str === null) {
      crypto.getRandomValues(arr)
      str = construct(bits, arr, 8)
    }
    return str
  }
  share(secretString, numShares, threshold) {
    if (!this.config.logs.length) {
      this.init()
    }
    if (numShares % 1 !== 0 || numShares < 2) {
      throw new Error(
        "Number of shares must be an integer between 2 and 2^bits-1 (" +
          this.config.max +
          "), inclusive."
      )
    }
    if (numShares > this.config.max) {
      var neededBits = Math.ceil(Math.log(numShares + 1) / Math.LN2)
      throw new Error(
        "Number of shares must be an integer between 2 and 2^bits-1 (" +
          this.config.max +
          "), inclusive. To create " +
          numShares +
          " shares, use at least " +
          neededBits +
          " bits."
      )
    }
    if (threshold % 1 !== 0 || threshold < 2) {
      throw new Error(
        "Threshold number of shares must be an integer between 2 and 2^bits-1 (" +
          this.config.max +
          "), inclusive."
      )
    }
    if (threshold > this.config.max) {
      var neededBits = Math.ceil(Math.log(threshold + 1) / Math.LN2)
      throw new Error(
        "Threshold number of shares must be an integer between 2 and 2^bits-1 (" +
          this.config.max +
          "), inclusive.  To use a threshold of " +
          threshold +
          ", use at least " +
          neededBits +
          " bits."
      )
    }
    // append a 1 so that we can preserve the correct number of leading zeros in our secret
    const secret = this.split("1" + this.hex2bin(secretString), 0)
    const x = new Array(numShares),
      y = new Array(numShares)
    for (var i = 0, len = secret.length; i < len; i++) {
      var subShares = this._getShares(secret[i], numShares, threshold)
      for (var j = 0; j < numShares; j++) {
        x[j] = x[j] || subShares[j].x.toString(this.config.radix)
        y[j] = this.padLeft(subShares[j].y.toString(2)) + (y[j] ? y[j] : "")
      }
    }
    const padding = this.config.max.toString(this.config.radix).length
    return y.map(
      (b, idx) =>
        this.config.bits.toString(16).toUpperCase() +
        this.padLeft(x[idx], padding) +
        this.bin2hex(b)
    )
  }
  // This is the basic polynomial generation and evaluation function
  // for a `config.bits`-length secret (NOT an arbitrary length)
  // Note: no error-checking at this stage! If `secrets` is NOT
  // a NUMBER less than 2^bits-1, the output will be incorrect!
  _getShares(secret, numShares, threshold) {
    var shares = []
    var coeffs = [secret]
    for (var i = 1; i < threshold; i++) {
      coeffs[i] = parseInt(this.random(this.config.bits), 16)
    }
    for (var i = 1, len = numShares + 1; i < len; i++) {
      shares[i - 1] = {
        x: i,
        y: this.horner(i, coeffs)
      }
    }
    return shares
  }
  // Polynomial evaluation at `x` using Horner's Method
  // TODO: this can possibly be sped up using other methods
  // NOTE: fx=fx * x + coeff[i] ->  exp(log(fx) + log(x)) + coeff[i],
  //       so if fx===0, just set fx to coeff[i] because
  //       using the exp/log form will result in incorrect value
  horner(x, coeffs) {
    var logx = this.config.logs[x]
    var fx = 0
    for (var i = coeffs.length - 1; i >= 0; i--) {
      if (fx === 0) {
        fx = coeffs[i]
        continue
      }
      fx = this.config.exps[(logx + this.config.logs[fx]) % this.config.max] ^ coeffs[i]
    }
    return fx
  }
  processShare(share) {
    var bits = parseInt(share[0], 16)
    if (bits && (bits % 1 !== 0 || bits < this.config.minBits || bits > this.config.maxBits)) {
      throw new Error(
        "Number of bits must be an integer between " +
          this.config.minBits +
          " and " +
          this.config.maxBits +
          ", inclusive."
      )
    }
    var max = Math.pow(2, bits) - 1
    var idLength = max.toString(this.config.radix).length
    var id = parseInt(share.substr(1, idLength), this.config.radix)
    if (id % 1 !== 0 || id < 1 || id > max) {
      throw new Error(
        "Share id must be an integer between 1 and " + this.config.max + ", inclusive."
      )
    }
    share = share.substr(idLength + 1)
    if (!share.length) {
      throw new Error("Invalid share: zero-length share.")
    }
    return {
      bits: bits,
      id: id,
      value: share
    }
  }
  _combine(at, shares) {
    if (!this.config.logs.length) {
      this.init()
    }
    let x = []
    let y = []
    let result = ""
    let idx
    for (var i = 0, len = shares.length; i < len; i++) {
      const share = this.processShare(shares[i])
      if (x.includes(share["id"])) {
        // repeated x value?
        continue
      }
      idx = x.push(share["id"]) - 1
      const shareValues = this.split(this.hex2bin(share["value"]))
      for (var j = 0, len2 = shareValues.length; j < len2; j++) {
        y[j] = y[j] || []
        y[j][idx] = shareValues[j]
      }
    }
    for (var i = 0, len = y.length; i < len; i++) {
      result = this.padLeft(this.lagrange(at, x, y[i]).toString(2)) + result
    }
    if (at === 0) {
      // reconstructing the secret
      return this.bin2hex(result.slice(result.indexOf("1") + 1))
    } else {
      // generating a new share
      return this.bin2hex(result)
    }
  }
  combine(shares) {
    return this._combine(0, shares)
  }
  // Generate a new share with id `id` (a number between 1 and 2^bits-1)
  // `id` can be a Number or a String in the default radix (16)
  newShare(id, shares) {
    if (typeof id === "string") {
      id = parseInt(id, this.config.radix)
    }
    var share = this.processShare(shares[0])
    var max = Math.pow(2, share["bits"]) - 1
    if (id % 1 !== 0 || id < 1 || id > max) {
      throw new Error(
        "Share id must be an integer between 1 and " + this.config.max + ", inclusive."
      )
    }
    var padding = max.toString(this.config.radix).length
    return (
      this.config.bits.toString(16).toUpperCase() +
      this.padLeft(id.toString(this.config.radix), padding) +
      this._combine(id, shares)
    )
  }
  // Evaluate the Lagrange interpolation polynomial at x = `at`
  // using x and y Arrays that are of the same length, with
  // corresponding elements constituting points on the polynomial.
  lagrange(at, x, y) {
    let sum = 0,
      product,
      i,
      j,
      len
    for (i = 0, len = x.length; i < len; i++) {
      if (!y[i]) {
        continue
      }
      product = this.config.logs[y[i]]
      for (j = 0; j < len; j++) {
        if (i === j) {
          continue
        }
        if (at === x[j]) {
          // happens when computing a share that is in the list of shares used to compute it
          product = -1 // fix for a zero product term, after which the sum should be sum^0 = sum, not sum^1
          break
        }
        product =
          (product +
            this.config.logs[at ^ x[j]] -
            this.config.logs[x[i] ^ x[j]] +
            this.config.max) /* to make sure it's not negative */ %
          this.config.max
      }
      sum = product === -1 ? sum : sum ^ this.config.exps[product] // though exps[-1]= undefined and undefined ^ anything = anything in chrome, this behavior may not hold everywhere, so do the check
    }
    return sum
  }
}
exports.ShamirClass = ShamirClass
exports.shamir = new ShamirClass()
//# sourceMappingURL=shamir.js.map
