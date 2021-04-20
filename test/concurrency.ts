import { utils } from '../icc-x-api'
import { expect } from 'chai'
import 'mocha'

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

describe('Concurrency test', () => {
  it('should return ordered sequence', async () => {
    const cm = {}
    const seq1: number[] = []
    const seq2: number[] = []

    const ctrl = await Promise.all(
      [500, 400, 300, 200, 100].map(async (x, idx) => {
        await delay(x)
        seq1.push(idx)
        return idx
      })
    )
    const res = await Promise.all(
      [500, 400, 300, 200, 100].map((x, idx) =>
        utils.notConcurrent(cm, '123', async () => {
          await delay(x)
          seq2.push(idx)
          return idx
        })
      )
    )

    expect(seq1).to.not.eql(ctrl)
    expect(seq2).to.eql(res)
  })
})
