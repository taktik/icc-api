export declare class UuidEncoder {
  private encStr
  private isCaseSensitive
  private base
  /**
   * @public
   * @param [baseEncodingStr] A string containing all usable letters for encoding
   * @constructor
   */
  constructor(baseEncodingStr?: string)
  /**
   * Set encoding base
   * @param {string} baseEncodingStr A string containing all usable letters for encoding
   * @public
   */
  setBaseEncodingStr(baseEncodingStr: string): void
  /**
   * @private
   * @param {string} baseEncodingStr
   * @returns {string}
   */
  static resolveEncodingStr(baseEncodingStr: string): string
  /**
   * @public
   * @param baseEncodingStr
   * @returns {boolean}
   */
  static isCaseSensitiveBase(baseEncodingStr: string): boolean
  /**
   * Encode a UUID
   * @param {string} uuid Properly formatted UUID
   * @returns {string} Encoded UUID
   * @public
   */
  encode(uuid: string): string
  /**
   * Decode an encoded UUID
   * @public
   * @param {string} str Previously encoded string
   * @returns {string} Properly formatted UUID
   * @throws Throws an {Error} when encountering invalid data
   */
  decode(str: string): string
}
