import { crypto } from "../node-compat"
import { ShamirClass } from "../icc-x-api/crypto/shamir"
import { expect } from "chai"
import "mocha"
import { Filter } from "../icc-x-api/filters/filters"

describe("Composition", () => {
  it("or should return an or combining other filters", () => {
    const builder = Filter.patient().olderThan(65).or().youngerThan(18)
    const filter = builder.build()

    expect((filter as any).$type).to.equal("UnionFilter")
  })

  it("and should work with or", () => {
    const builder = Filter.patient().olderThan(65).or().youngerThan(18).and().searchByName("dup")
    const filter = builder.build()

    expect((filter as any).$type).to.equal("IntersectionFilter")
    expect((filter as any).filters[0].$type).to.equal("UnionFilter")
  })
})
