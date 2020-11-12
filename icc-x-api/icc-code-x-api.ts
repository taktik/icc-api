import { IccCodeApi } from "../icc-api"

import codeLanguages from "./rsrc/codelng"
import icd10 from "./rsrc/icd10"
import icpc2 from "./rsrc/icpc2"

import * as _ from "lodash"
import { Code } from "../icc-api/model/Code"

export class IccCodeXApi extends IccCodeApi {
  icd10: any = icd10
  icpc2: any = icpc2
  codeLanguages: any = codeLanguages

  constructor(
    host: string,
    headers: { [key: string]: string },
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !==
    "undefined"
      ? window.fetch
      : typeof self !== "undefined"
        ? self.fetch
        : fetch
  ) {
    super(host, headers, fetchImpl)
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
  normalize(c: Code | string) {
    return typeof c === "string"
      ? {
          id: c,
          type: c.split(/\|/)[0],
          code: c.split(/\|/)[1],
          version: c.split(/\|/)[2]
        }
      : (c as Code).type && (c as Code).code && !(c as Code).id
        ? {
            id: (c as Code).type + "|" + (c as Code).code + "|" + ((c as Code).version || "1"),
            type: (c as Code).type,
            code: (c as Code).code,
            version: (c as Code).version || "1"
          }
        : (c as Code).id && (!(c as Code).code || !(c as Code).type || !(c as Code).version)
          ? {
              id: (c as Code).id,
              type: (c as Code).id!.split(/\|/)[0],
              code: (c as Code).id!.split(/\|/)[1],
              version: (c as Code).id!.split(/\|/)[2]
            }
          : {
              id: (c as Code).id!,
              type: (c as Code).type,
              code: (c as Code).code,
              version: (c as Code).version || "1"
            }
  }
}
