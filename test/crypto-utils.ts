import { UtilsClass } from "../icc-x-api"
import { expect } from "chai"
import "mocha"
import { b64_2ua, hex2ua, ua2b64, ua2hex, ua2string } from ".."
import { crypto } from "../node-compat"
import { RSAUtils } from "../icc-x-api/crypto/RSA"
import { b64Url2ua, ua2b64Url } from "../icc-x-api/utils/binary-utils"

describe("ArrayBuffer methods", () => {
  let utils: UtilsClass
  let rsa: RSAUtils

  before(() => {
    utils = new UtilsClass()
    rsa = new RSAUtils(crypto)
  })

  describe("truncateTrailingNulls", () => {
    it("should truncate trailing nulls out of an Uint8Array without copying", () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalArray = Uint8Array.from([...bytes, 0, 0])
      const truncatedArray = utils.truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })

    it("should preserve the offset into the buffer", () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalBuffer = new Uint8Array([0, 0, ...bytes, 0, 0]).buffer
      const originalArray = new Uint8Array(originalBuffer, 2, bytes.length)
      const truncatedArray = utils.truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(truncatedArray.byteOffset).to.equal(originalArray.byteOffset)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })
  })

  describe("convertKeysFormat", () => {
    it("should convert spki to jwk in a coherent way", async () => {
      const pubKey =
        "30820122300d06092a864886f70d01010105000382010f003082010a0282010100d862a7597d21da6f8972c02fc4e71d456d3b4fdfff7beffd1759d81fdeabf63c00af6cc15a634bc3a537d7c666d648c93951a496eaeb07c58f8bbe840c4b0375201f3f6cd9ac631150d412111c9d85bf1012dc88188464c07335481af8285aa595078433563b40503ecb2db8ff50836db9fd0a14f4473eee5538766471ae4151a6ee94eeaaa2ee16d4655dff71f7b25958359894e18d535450aa0e8aa8ca72e3f6046c1bc75792748560148bedc5af3f8525465384ad2020dcf28eba45e2aab8fcfde0a79c1fcc1fbd4778cdebd3eb0af62d6e8ef845dc0251d1e0a7e6d2e358f8b4d39db5ffa4021e8a351a8d768308ddacacc2a22814301da64931c477ef410203010001"
      const jwk1 = utils.spkiToJwk(hex2ua(pubKey))
      const rsaKey1 = await rsa.importKey("jwk", jwk1, ["encrypt"])
      const rsaKey2 = await rsa.importKey("spki", hex2ua(pubKey), ["encrypt"])
      const jwk2 = await rsa.exportKey(rsaKey2, "jwk")
      const rsaKey3 = await rsa.importKey("jwk", jwk2, ["encrypt"])

      const n1 = ua2hex(b64Url2ua(jwk1.n))
      const n2 = ua2hex(b64Url2ua(jwk2.n!))

      expect(jwk1.n).to.equal(jwk2.n)
    })
  })
})
