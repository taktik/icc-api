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

import { decodeBase64 } from "./ModelHelper"

export class ReferralPeriodDto {
  constructor(json: JSON | any) {
    Object.assign(this as ReferralPeriodDto, json)
  }

  startDate?: number
  endDate?: number
  comment?: string
}