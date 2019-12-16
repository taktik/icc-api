"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const _ = require("lodash")
/**
 * Normalizes the code's four main fields (type, code, version and id). The first three are considered to be
 * authoritative, while the id is a pure function of them. The authoritative fields are filled in from the id if
 * missing, or the version is set to '1' if it is the only missing authoritative field. The id is then rederived from
 * the three fields.
 * @param code The code to normalize.
 * @returns A shallow copy of the input with its type, code, version and id normalized.
 */
function normalizeCode(code) {
  code = _.clone(code)
  if (code.type && code.code && code.version) {
    // do nothing, we all have the authoritative fields we need
  } else if (code.id) {
    // reconstruct the authoritative fields from the id
    const [idType, idCode, idVersion, ...idRest] = code.id.split("|")
    if (idType && idCode && idVersion && idRest.length === 0) {
      if (!code.type) code.type = idType
      if (!code.code) code.code = idCode
      if (!code.version) code.version = idVersion
    } else {
      throw new Error(`attempted to normalize from a malformed code id "${code.id}"`)
    }
  } else if (code.type && code.code && !code.version) {
    // we can provide a default value
    code.version = "1"
  } else {
    throw new Error("could not reconstruct the code")
  }
  // Recompute the id to ensure that it matches the reconstructed code.
  code.id = `${code.type}|${code.code}|${code.version}`
  return code
}
exports.normalizeCode = normalizeCode
//# sourceMappingURL=code-util.js.map
