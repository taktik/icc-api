export declare class ShamirClass {
  config: {
    bits: number
    radix: number
    size: number
    max: number
    minBits: number
    maxBits: number
    bytesPerChar: number
    maxBytesPerChar: number
    primitivePolynomials: (number | null)[]
    warning: string
    logs: number[]
    exps: number[]
  }
  private crypto
  constructor(crypto?: Crypto)
  init(): void
  split(str: string, padLength?: number): number[]
  bin2hex(str: string): string
  hex2bin(str: string): string
  padLeft(str: string, bits?: number): string
  random(bits: number): string
  share(secretString: string, numShares: number, threshold: number): string[]
  _getShares(
    secret: number,
    numShares: number,
    threshold: number
  ): {
    x: number
    y: number
  }[]
  horner(x: number, coeffs: Array<number>): number
  processShare(
    share: string
  ): {
    bits: number
    id: number
    value: string
  }
  _combine(at: number, shares: Array<string>): string
  combine(shares: Array<string>): string
  newShare(id: number | string, shares: Array<string>): string
  lagrange(at: number, x: Array<number>, y: Array<number>): number
}
export declare const shamir: ShamirClass
