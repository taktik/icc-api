import { iccCodeApi } from "../icc-api/iccApi"

import codeLanguages from "./rsrc/codelng"
import icd10 from "./rsrc/icd10"
import icpc2 from "./rsrc/icpc2"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import { CodeDto } from "../icc-api/model/CodeDto"

export class IccCodeXApi extends iccCodeApi {
  icd10: any = icd10
  icpc2: any = icpc2
  codeLanguages: any = codeLanguages

  constructor(host: string, headers: Array<XHR.Header>) {
    super(host, headers)
  }

  // noinspection JSUnusedGlobalSymbols
  icdChapters(listOfCodes: Array<string>) {
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
            (acc: any, pairOfRangeAndIcdInfo, code) => {
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
        (c: any) => c.shortKey
      )
    )
  }

  // noinspection JSUnusedGlobalSymbols
  icpcChapters(listOfCodes: Array<string>) {
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
            (acc: any, pairOfRangeAndIcdInfo, code) => {
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
        (c: any) => c.shortKey
      )
    )
  }

  // noinspection JSUnusedGlobalSymbols
  languageForType(type: string, lng: string) {
    const availableLanguages = this.codeLanguages[type]
    return availableLanguages && availableLanguages.indexOf(lng) >= 0 ? lng : "fr"
  }

  // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
  normalize(c: CodeDto | string) {
    return typeof c === "string"
      ? {
          id: c,
          type: c.split(/\|/)[0],
          code: c.split(/\|/)[1],
          version: c.split(/\|/)[2]
        }
      : (c as CodeDto).type && (c as CodeDto).code && !(c as CodeDto).id
        ? {
            id:
              (c as CodeDto).type +
              "|" +
              (c as CodeDto).code +
              "|" +
              ((c as CodeDto).version || "1"),
            type: (c as CodeDto).type,
            code: (c as CodeDto).code,
            version: (c as CodeDto).version || "1"
          }
        : (c as CodeDto).id &&
          (!(c as CodeDto).code || !(c as CodeDto).type || !(c as CodeDto).version)
          ? {
              id: (c as CodeDto).id,
              type: (c as CodeDto).id!.split(/\|/)[0],
              code: (c as CodeDto).id!.split(/\|/)[1],
              version: (c as CodeDto).id!.split(/\|/)[2]
            }
          : {
              id: (c as CodeDto).id!,
              type: (c as CodeDto).type,
              code: (c as CodeDto).code,
              version: (c as CodeDto).version || "1"
            }
  }
}
