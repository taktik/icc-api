import Decimal from "decimal.js"
import { utils } from "./utils"

Decimal.set({ rounding: 5 })
Decimal.set({ modulo: Decimal.ROUND_FLOOR })
Decimal.set({ crypto: true })
Decimal.set({ precision: 1e4 })
Decimal.set({ toExpPos: 1000 })

export class ShamirClass {
  prime512 = new Decimal("2").pow(512).sub(1)
  prime3217 = new Decimal("2").pow(3217).sub(1)
  prime19937 = new Decimal("2").pow(19937).sub(1)

  divmod(a: Decimal.Value, b: Decimal.Value, n: Decimal.Value) {
    const aCopy = Decimal.isDecimal(a) ? (a as Decimal) : new Decimal(a)
    const bCopy = Decimal.isDecimal(b) ? (b as Decimal) : new Decimal(b)
    const nCopy = Decimal.isDecimal(n) ? (n as Decimal) : new Decimal(n)

    let t = new Decimal("0")
    let nt = new Decimal("1")
    let r = nCopy
    let nr = bCopy.mod(n)
    let tmp

    while (!nr.isZero()) {
      let quot = Decimal.floor(r.div(nr))
      tmp = nt
      nt = t.sub(quot.times(nt))
      t = tmp
      tmp = nr
      nr = r.sub(quot.times(nr))
      r = tmp
    }

    if (r.greaterThan(1)) return new Decimal(0)
    if (t.isNegative()) t = t.add(n)
    return aCopy.times(t).mod(n)
  }

  random(lowerValue: Decimal.Value, upperValue: Decimal.Value) {
    let lower = new Decimal(lowerValue)
    let upper = new Decimal(upperValue)

    if (lower.greaterThan(upper)) {
      const temp = lower
      lower = upper
      upper = temp
    }

    return lower.add(
      Decimal.random()
        .times(upper.sub(lower.add(1)))
        .floor()
    )
  }

  // Polynomial function where `a` is the coefficients
  q(xValue: Decimal.Value, { a }: { [key: string]: Array<Decimal.Value> }) {
    let value = new Decimal(a[0])
    const x = new Decimal(xValue)
    for (let i = 1; i < a.length; i++) {
      value = new Decimal(value).add(x.pow(i).times(a[i]))
    }

    return value
  }

  split(
    secret: Uint8Array,
    n: number,
    k: number
  ): { prime: string; shares: Array<{ x: string; y: string }> } {
    const S = new Decimal("0x" + utils.ua2hex(secret))
    const p = S.lessThanOrEqualTo(this.prime512)
      ? new Decimal(this.prime512)
      : S.lessThanOrEqualTo(this.prime3217)
        ? new Decimal(this.prime3217)
        : new Decimal(this.prime19937)

    if (S.greaterThan(p)) {
      throw new RangeError("Your secret is too big.")
    }

    let a = [S]
    let D = []

    for (let i = 1; i < k; i++) {
      let coeff = this.random(new Decimal(0), p.sub(0x1))
      a.push(coeff)
    }

    for (let i = 0; i < n; i++) {
      let x = new Decimal(i + 1)
      D.push({
        x,
        y: this.q(x, { a }).mod(p)
      })
    }

    return {
      prime: p.toHex(),
      shares: D.map(share => ({
        x: share.x.toHex(),
        y: share.y.toHex()
      }))
    }
  }

  lagrangeBasis(data: Array<{ x: Decimal; y: Decimal }>, j: number) {
    // Lagrange basis evaluated at 0, i.e. L(0).
    // You don't need to interpolate the whole polynomial to get the secret, you
    // only need the constant term.
    let denominator = new Decimal(1)
    let numerator = new Decimal(1)
    for (let i = 0; i < data.length; i++) {
      if (!data[j].x.equals(data[i].x)) {
        denominator = denominator.times(data[i].x.minus(data[j].x))
      }
    }

    for (let i = 0; i < data.length; i++) {
      if (!data[j].x.equals(data[i].x)) {
        numerator = numerator.times(data[i].x)
      }
    }

    return {
      numerator,
      denominator
    }
  }

  lagrangeInterpolate(prime: Decimal, data: Array<{ x: Decimal; y: Decimal }>) {
    let S = new Decimal(0)

    for (let i = 0; i < data.length; i++) {
      let basis = this.lagrangeBasis(data, i)
      S = S.add(data[i].y.times(this.divmod(basis.numerator, basis.denominator, prime)))
    }
    return S.mod(prime)
  }

  combine(prime: Decimal.Value, shares: Array<{ x: Decimal.Value; y: Decimal.Value }>): Uint8Array {
    const p = new Decimal(prime)

    // Wrap with Decimal on the input shares
    const decimalShares = shares.map(share => ({
      x: new Decimal(share.x),
      y: new Decimal(share.y)
    }))

    return utils.hex2ua(
      this.lagrangeInterpolate(p, decimalShares)
        .toHex()
        .substring(2)
    )
  }
}

export const shamir = new ShamirClass()
