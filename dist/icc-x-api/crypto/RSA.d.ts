export declare class RSAUtils {
  /********* RSA Config **********/
  rsaParams: any
  rsaHashedParams: any
  rsaLocalStoreIdPrefix: string
  rsaKeyPairs: any
  private crypto
  constructor(crypto?: Crypto)
  /**
   * It returns CryptoKey promise, which doesn't hold the bytes of the key.
   * If bytes are needed, you must export the generated key.
   * R
   * @returns {Promise} will be {publicKey: CryptoKey, privateKey: CryptoKey}
   */
  generateKeyPair(): Promise<CryptoKey | CryptoKeyPair>
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
    keyPair: {
      publicKey: CryptoKey
      privateKey: CryptoKey
    },
    privKeyFormat: string,
    pubKeyFormat: string
  ): Promise<{
    publicKey: ArrayBuffer | JsonWebKey
    privateKey: ArrayBuffer | JsonWebKey
  }>
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
  exportKey(cryptoKey: CryptoKey, format: string): Promise<ArrayBuffer | JsonWebKey>
  /**
   *
   * @param publicKey (CryptoKey)
   * @param plainData (Uint8Array)
   */
  encrypt(publicKey: CryptoKey, plainData: Uint8Array): Promise<ArrayBuffer>
  /**
   *
   * @param privateKey (CryptoKey)
   * @param encryptedData (Uint8Array)
   */
  decrypt(privateKey: CryptoKey, encryptedData: Uint8Array): Promise<ArrayBuffer>
  /**
   *
   * @param format 'jwk', 'spki', or 'pkcs8'
   * @param keydata should be the key data based on the format.
   * @param keyUsages Array of usages. For example, ['encrypt'] for public key.
   * @returns {*}
   */
  importKey(
    format: string,
    keydata: JsonWebKey | ArrayBuffer,
    keyUsages: Array<string>
  ): Promise<CryptoKey>
  /**
   *
   * @param format 'jwk' or 'pkcs8'
   * @param keydata should be the key data based on the format.
   * @returns {*}
   */
  importPrivateKey(format: string, keydata: JsonWebKey | ArrayBuffer): Promise<CryptoKey>
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
  ): Promise<{
    publicKey: CryptoKey
    privateKey: CryptoKey
  }>
  /**
   *
   * @param id
   * @param keyPair should be JWK
   */
  storeKeyPair(
    id: string,
    keyPair: {
      publicKey: any
      privateKey: any
    }
  ): void
  /**
   * loads the RSA key pair (hcparty) in JWK, not imported
   *
   * @param id  doc id - hcpartyId
   * @returns {Object} it is in JWK - not imported
   */
  loadKeyPairNotImported(
    id: string
  ): {
    publicKey: any
    privateKey: any
  }
  /**
   * Loads and imports the RSA key pair (hcparty)
   *
   * @param id  doc id - hcPartyId
   * @returns {Promise} -> {CryptoKey} - imported RSA
   */
  loadKeyPairImported(
    id: string
  ): Promise<{
    publicKey: CryptoKey
    privateKey: CryptoKey
  }>
}
export declare const RSA: RSAUtils
