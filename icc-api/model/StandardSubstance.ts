/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { SamText } from "./SamText"

import { decodeBase64 } from "./ModelHelper"

export class StandardSubstance {
  constructor(json: JSON | any) {
    Object.assign(this as StandardSubstance, json)
  }

  code?: string
  type?: StandardSubstance.TypeEnum
  name?: SamText
  definition?: SamText
  url?: string
}
export namespace StandardSubstance {
  export type TypeEnum = "CAS" | "DM_D" | "EDQM" | "SNOMED_CT"
  export const TypeEnum = {
    CAS: "CAS" as TypeEnum,
    DMD: "DM_D" as TypeEnum,
    EDQM: "EDQM" as TypeEnum,
    SNOMEDCT: "SNOMED_CT" as TypeEnum
  }
}