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
