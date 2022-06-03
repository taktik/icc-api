import { User } from '../../icc-api/model/User'
import { hex2ua } from '../../icc-x-api/utils/binary-utils'
import { PRIVATE_KEYS } from '../standalone-test.env'

export async function generateSecureRandom(length: number) {
  const uint8Array = new Uint8Array(length)
  while (length && length--) {
    uint8Array[length] = Math.floor(Math.random() * 256)
  }
  return await Promise.resolve(uint8Array)
}

//  Stronger random generator should be used in production usage
export async function initSecuredCrypto(isoCrypto: any) {
  await new Promise((resolve, reject) => {
    if (!isoCrypto.initPrng) return resolve(false)
    return generateSecureRandom(48)
      .then((byteArray) => {
        isoCrypto.initPrng(Array.from(byteArray))
        resolve(true)
      })
      .catch((err) => reject(err))
  })
}

export async function loadPrivateKeys(api: any, user: User) {
  let id = user.healthcarePartyId
  while (id) {
    await api.cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(id, hex2ua(PRIVATE_KEYS[id])).catch((error: any) => {
      console.error('Error: in loadKeyPairsAsTextInBrowserLocalStorage')
      console.error(error)
    })

    id = (await api.healthcarePartyApi.getHealthcareParty(id)).parentId
  }
}
