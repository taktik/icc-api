"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const iccApi_1 = require("../icc-api/iccApi")
const codelng_1 = require("./rsrc/codelng")
const icd10_1 = require("./rsrc/icd10")
const icpc2_1 = require("./rsrc/icpc2")
const _ = require("lodash")
class IccCodeXApi extends iccApi_1.iccCodeApi {
  constructor(
    host,
    headers,
    fetchImpl = typeof window !== "undefined" ? window.fetch : self.fetch
  ) {
    super(host, headers, fetchImpl)
    this.icd10 = icd10_1.default
    this.icpc2 = icpc2_1.default
    this.codeLanguages = codelng_1.default
  }
  // noinspection JSUnusedGlobalSymbols
  icdChapters(listOfCodes) {
    return Promise.resolve(
      _.sortBy(
        _.values(
          _.reduce(
            _.fromPairs(
              listOfCodes.map(code => [
                code,
                _.toPairs(this.icd10).find(([k]) => {
                  const parts = k.split(/-/)
                  return code.substr(0, 3) >= parts[0] && code.substr(0, 3) <= parts[1]
                })
              ])
            ),
            (acc, pairOfRangeAndIcdInfo, code) => {
              if (!pairOfRangeAndIcdInfo) {
                return acc
              }
              const shortKey = pairOfRangeAndIcdInfo[0].substr(0, 2)
              ;(
                acc[shortKey] ||
                (acc[shortKey] = {
                  code: shortKey,
                  descr: pairOfRangeAndIcdInfo[1],
                  subCodes: []
                })
              ).subCodes.push(code)
              return acc
            },
            {}
          )
        ),
        c => c.shortKey
      )
    )
  }
  // noinspection JSUnusedGlobalSymbols
  icpcChapters(listOfCodes) {
    return Promise.resolve(
      _.sortBy(
        _.values(
          _.reduce(
            _.fromPairs(
              listOfCodes.map(code => [
                code,
                _.toPairs(this.icpc2).find(([k]) => k === code.substr(0, 1).toUpperCase())
              ])
            ),
            (acc, pairOfRangeAndIcdInfo, code) => {
              if (!pairOfRangeAndIcdInfo) {
                return acc
              }
              const shortKey = pairOfRangeAndIcdInfo[0]
              ;(
                acc[shortKey] ||
                (acc[shortKey] = {
                  code: shortKey,
                  descr: pairOfRangeAndIcdInfo[1],
                  subCodes: []
                })
              ).subCodes.push(code)
              return acc
            },
            {}
          )
        ),
        c => c.shortKey
      )
    )
  }
  // noinspection JSUnusedGlobalSymbols
  languageForType(type, lng) {
    const availableLanguages = this.codeLanguages[type]
    return availableLanguages && availableLanguages.indexOf(lng) >= 0 ? lng : "fr"
  }
  // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
  normalize(c) {
    return typeof c === "string"
      ? {
          id: c,
          type: c.split(/\|/)[0],
          code: c.split(/\|/)[1],
          version: c.split(/\|/)[2]
        }
      : c.type && c.code && !c.id
        ? {
            id: c.type + "|" + c.code + "|" + (c.version || "1"),
            type: c.type,
            code: c.code,
            version: c.version || "1"
          }
        : c.id && (!c.code || !c.type || !c.version)
          ? {
              id: c.id,
              type: c.id.split(/\|/)[0],
              code: c.id.split(/\|/)[1],
              version: c.id.split(/\|/)[2]
            }
          : {
              id: c.id,
              type: c.type,
              code: c.code,
              version: c.version || "1"
            }
  }
}
exports.IccCodeXApi = IccCodeXApi
//# sourceMappingURL=icc-code-x-api.js.map
