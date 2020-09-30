import { UtilsClass } from "../icc-x-api/crypto/utils"
import { expect } from "chai"
import "mocha"

describe("ArrayBuffer methods", () => {
  let utils: UtilsClass

  before(() => {
    utils = new UtilsClass()
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
})
