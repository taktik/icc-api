import { expect } from 'chai'
import { IccLocalStorageProxy } from '../../../icc-x-api/storage/icc-local-storage-proxy'
import { IccLocalStorage } from '../../../icc-x-api/storage/icc-local-storage'

describe('IccLocalStorage Tests', () => {
  it('Should makes the diffrence between instance and value', async () => {
    const A = new Array('Hello,', 'world!')
    const B = new Array('Hello,', 'world!')

    expect(A).to.not.equal(B)
    expect(A === B).to.equal(false)
    expect(A == B).to.equal(false)

    expect(A[0]).to.equal(B[0])
    expect(A[1]).to.equal(B[1])

    expect(A.toString() === B.toString()).to.equal(true)
    expect(A.toString() == B.toString()).to.equal(true)
  })

  it('Should be a singleton', async () => {
    const L1 = IccLocalStorage.getInstance()
    const L2 = IccLocalStorage.getInstance()

    expect(L1).to.equal(L2)
    expect(L1 === L2).to.equal(true)

    L1.setItem('a', '2')

    const value1 = L1.getItem('a')

    expect(value1).to.not.equal('3')
    expect(value1).to.equal('2')
    expect(value1).to.equal(L2.getItem('a'))
    expect(L1.length).to.equal(L2.length)

    L1.clear()
    expect(L1.length).to.equal(L2.length)
    expect(L1.length).to.equal(0)
  })

  it('Should be a singleton (via Proxy)', async () => {
    const L1 = IccLocalStorage.getInstance()
    const L2 = IccLocalStorageProxy.getInstance()

    L1.setItem('a', '2')

    const value1 = L1.getItem('a')

    expect(value1).to.not.equal('3')
    expect(value1).to.equal('2')
    expect(value1).to.equal(L2.getItem('a'))
    console.log('L1.length: ', L1.length)
    console.log('L2.length: ', L2.length)
    expect(L1.length).to.equal(L2.length)

    L1.clear()
    expect(L1.length).to.equal(L2.length)
    expect(L1.length).to.equal(0)
  })

  it('Should return null', async () => {
    const L = IccLocalStorageProxy.getInstance()
    expect(L.getItem('a')).to.equal(null)
    L.clear()
  })

  it('Should return null (Proxy)', async () => {
    const L = IccLocalStorageProxy.getInstance()
    expect(L.getItem('a')).to.equal(null)
    L.clear()
  })

  it('Should conform to Storage API', async () => {
    const L = IccLocalStorage.getInstance()

    L.setItem('Hello,', 'world!')
    expect(L.getItem('Hello,')).to.equal('world!')

    const o = { a: 1, b: 'Hello, world!', c: { x: 1, y: 2 } }
    L.setItem('2', JSON.stringify(o))
    expect(L.getItem('2')).to.deep.equal(JSON.stringify(o))

    const a = [1, 'some string', { a: 1, b: 'some string', c: { x: 1, y: 2 } }]
    L.setItem('2', JSON.stringify(a))
    expect(L.getItem('2')).to.deep.equal(JSON.stringify(a))

    expect([L.key(0), L.key(1)])
      .to.be.an('array')
      .that.includes('Hello,')
    expect([L.key(0), L.key(1)])
      .to.be.an('array')
      .that.includes('2')
    expect(L.length).to.equal(2)

    L.removeItem('2')
    expect(L.getItem('2')).to.equal(null)

    expect([L.key(0)]).to.deep.equal(['Hello,'])
    expect(L.length).to.equal(1)

    expect(L.key(0)).to.equal('Hello,')
    L.clear()
    expect(L.length).to.equal(0)
  })

  it('Should conform to Storage API (Proxy)', async () => {
    const L = IccLocalStorageProxy.getInstance()

    L.setItem('Hello,', 'world!')
    expect(L.getItem('Hello,')).to.equal('world!')

    const o = { a: 1, b: 'Hello, world!', c: { x: 1, y: 2 } }
    L.setItem('2', JSON.stringify(o))
    expect(L.getItem('2')).to.deep.equal(JSON.stringify(o))

    const a = [1, 'some string', { a: 1, b: 'some string', c: { x: 1, y: 2 } }]
    L.setItem('2', JSON.stringify(a))
    expect(L.getItem('2')).to.deep.equal(JSON.stringify(a))

    expect([L.key(0), L.key(1)])
      .to.be.an('array')
      .that.includes('Hello,')
    expect([L.key(0), L.key(1)])
      .to.be.an('array')
      .that.includes('2')
    expect(L.length).to.equal(2)

    L.removeItem('2')
    expect(L.getItem('2')).to.equal(null)

    expect([L.key(0)]).to.deep.equal(['Hello,'])
    expect(L.length).to.equal(1)

    expect(L.key(0)).to.equal('Hello,')
    L.clear()
  })
})
