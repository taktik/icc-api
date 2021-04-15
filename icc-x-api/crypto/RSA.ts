export class RSAUtils {
  /********* RSA Config **********/
  //TODO bigger modulus
  //TODO check the randomness of the implementations. Normally RSA must have some notions of randomness. This might be done through WebCrypto source codes
  //TODO PSS for signing
  rsaParams: any = { name: "RSA-OAEP" }
  // RSA params for 'import' and 'generate' function.
  rsaHashedParams: any = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // Equivalent to 65537 (Fermat F4), read http://en.wikipedia.org/wiki/65537_(number)
    hash: { name: "sha-1" }
  }
  rsaLocalStoreIdPrefix: string = "org.taktik.icure.rsa."
  rsaKeyPairs: any = {}
  private crypto: Crypto

  constructor(
    crypto: Crypto = typeof window !== "undefined"
      ? window.crypto
      : typeof self !== "undefined"
        ? self.crypto
        : ({} as Crypto)
  ) {
    this.crypto = crypto
  }

  /**
   * It returns CryptoKey promise, which doesn't hold the bytes of the key.
   * If bytes are needed, you must export the generated key.
   * R
   * @returns {Promise} will be {publicKey: CryptoKey, privateKey: CryptoKey}
   */
  generateKeyPair() {
    var extractable = true
    var keyUsages = ["decrypt", "encrypt"]

    return new Promise((resolve: (value: CryptoKey | CryptoKeyPair) => any, reject) => {
      this.crypto.subtle
        .generateKey(this.rsaHashedParams, extractable, keyUsages)
        .then(resolve, reject)
    })
  }

  /**
   *
   * 'JWK': Json Web key (ref. http://tools.ietf.org/html/draft-ietf-jose-json-web-key-11)
   * 'spki': for private key
   * 'pkcs8': for private Key
   *
   * @param keyPair is {publicKey: CryptoKey, privateKey: CryptoKey}
   * @param privKeyFormat will be 'pkcs8' or 'jwk'
   * @param pubKeyFormat will be 'spki' or 'jwk'
   * @returns {Promise} will the AES Key
   */
  exportKeys(
    keyPair: { publicKey: CryptoKey; privateKey: CryptoKey },
    privKeyFormat: string,
    pubKeyFormat: string
  ) {
    var pubPromise = this.crypto.subtle.exportKey(pubKeyFormat, keyPair.publicKey)
    var privPromise = this.crypto.subtle.exportKey(privKeyFormat, keyPair.privateKey)

    return Promise.all([pubPromise, privPromise]).then(function(results) {
      return {
        publicKey: results[0],
        privateKey: results[1]
      }
    })
  }

  /**
   *  Format:
   *
   * 'JWK': Json Web key (ref. http://tools.ietf.org/html/draft-ietf-jose-json-web-key-11)
   * 'spki': for private key
   * 'pkcs8': for private Key
   *
   * @param cryptoKey public or private
   * @param format either 'jwk' or 'spki' or 'pkcs8'
   * @returns {Promise|*} will be RSA key (public or private)
   */
  exportKey(cryptoKey: CryptoKey, format: "jwk"): Promise<JsonWebKey>
  exportKey(cryptoKey: CryptoKey, format: "spki"): Promise<ArrayBuffer>
  exportKey(cryptoKey: CryptoKey, format: "pkcs8"): Promise<ArrayBuffer>
  exportKey(cryptoKey: CryptoKey, format: string): Promise<JsonWebKey | ArrayBuffer> {
    return new Promise((resolve: (value: JsonWebKey | ArrayBuffer) => any, reject) => {
      this.crypto.subtle.exportKey(format, cryptoKey).then(resolve, reject)
    })
  }

  /**
   *
   * @param publicKey (CryptoKey)
   * @param plainData (Uint8Array)
   */
  encrypt(publicKey: CryptoKey, plainData: Uint8Array) {
    return new Promise((resolve: (value: ArrayBuffer) => any, reject) => {
      this.crypto.subtle
        .encrypt(this.rsaParams, publicKey, plainData.buffer ? plainData.buffer : plainData)
        .then(resolve, reject) //Node prefers arrayBuffer
    })
  }

  /**
   *
   * @param privateKey (CryptoKey)
   * @param encryptedData (Uint8Array)
   */
  decrypt(privateKey: CryptoKey, encryptedData: Uint8Array): Promise<ArrayBuffer> {
    return new Promise((resolve: (value: ArrayBuffer) => any, reject) => {
      this.crypto.subtle.decrypt(this.rsaParams, privateKey, encryptedData).then(resolve, reject)
    })
  }

  /**
   *
   * @param format 'jwk', 'spki', or 'pkcs8'
   * @param keydata should be the key data based on the format.
   * @param keyUsages Array of usages. For example, ['encrypt'] for public key.
   * @returns {*}
   */
  importKey(format: string, keydata: JsonWebKey | ArrayBuffer, keyUsages: Array<string>) {
    var extractable = true
    return new Promise((resolve: (value: CryptoKey) => any, reject) => {
      this.crypto.subtle
        .importKey(format, keydata, this.rsaHashedParams, extractable, keyUsages)
        .then(resolve, reject)
    })
  }

  /**
   *
   * @param format 'jwk' or 'pkcs8'
   * @param keydata should be the key data based on the format.
   * @returns {*}
   */
  importPrivateKey(format: string, keydata: JsonWebKey | ArrayBuffer) {
    var extractable = true
    return new Promise((resolve: (value: CryptoKey) => any, reject) => {
      this.crypto.subtle
        .importKey(format, keydata, this.rsaHashedParams, extractable, ["decrypt"])
        .then(resolve, reject)
    })
  }

  /**
   *
   * @param privateKeyFormat 'jwk' or 'pkcs8'
   * @param privateKeydata    should be the key data based on the format.
   * @param publicKeyFormat 'jwk' or 'spki'
   * @param publicKeyData should be the key data based on the format.
   * @returns {Promise|*}
   */
  importKeyPair(
    privateKeyFormat: string,
    privateKeydata: JsonWebKey | ArrayBuffer,
    publicKeyFormat: string,
    publicKeyData: JsonWebKey | ArrayBuffer
  ) {
    var extractable = true
    var privPromise = this.crypto.subtle.importKey(
      privateKeyFormat,
      privateKeydata,
      this.rsaHashedParams,
      extractable,
      ["decrypt"]
    )
    var pubPromise = this.crypto.subtle.importKey(
      publicKeyFormat,
      publicKeyData,
      this.rsaHashedParams,
      extractable,
      ["encrypt"]
    )

    return Promise.all([pubPromise, privPromise]).then(function(results) {
      return {
        publicKey: results[0],
        privateKey: results[1]
      }
    })
  }

  /**
   *
   * @param id
   * @param keyPair should be JWK
   */
  storeKeyPair(id: string, keyPair: { publicKey: any; privateKey: any }) {
    if (typeof Storage === "undefined") {
      console.log("Your browser does not support HTML5 Browser Local Storage !")
      throw "Your browser does not support HTML5 Browser Local Storage !"
    }
    //TODO encryption
    localStorage.setItem(this.rsaLocalStoreIdPrefix + id, JSON.stringify(keyPair))
  }

  /**
   * loads the RSA key pair (hcparty) in JWK, not imported
   *
   * @param id  doc id - hcpartyId
   * @returns {Object} it is in JWK - not imported
   */
  loadKeyPairNotImported(id: string): { publicKey: any; privateKey: any } {
    if (typeof Storage === "undefined") {
      console.log("Your browser does not support HTML5 Browser Local Storage !")
      throw "Your browser does not support HTML5 Browser Local Storage !"
    }
    //TODO decryption
    return JSON.parse((localStorage.getItem(this.rsaLocalStoreIdPrefix + id) as string) || "{}")
  }

  /**
   * Loads and imports the RSA key pair (hcparty)
   *
   * @param id  doc id - hcPartyId
   * @returns {Promise} -> {CryptoKey} - imported RSA
   */
  loadKeyPairImported(id: string) {
    return new Promise(
      (resolve: (value: { publicKey: CryptoKey; privateKey: CryptoKey }) => any, reject) => {
        try {
          const jwkKey = localStorage.getItem(this.rsaLocalStoreIdPrefix + id) as string
          if (jwkKey) {
            const jwkKeyPair = JSON.parse(jwkKey)
            if (jwkKeyPair.publicKey && jwkKeyPair.privateKey) {
              this.importKeyPair("jwk", jwkKeyPair.privateKey, "jwk", jwkKeyPair.publicKey).then(
                resolve,
                err => {
                  console.log("Error in RSA.importKeyPair: " + err)
                  reject(err)
                }
              )
            } else {
              const message = "Error in RSA.importKeyPair: Invalid key"
              console.log(message)
              reject(Error(message))
            }
          } else {
            const message = "Error in RSA.importKeyPair: Missing key"
            console.log(message)
            reject(Error(message))
          }
        } catch (err) {
          reject(err)
        }
      }
    )
  }
}

export const RSA = new RSAUtils()
