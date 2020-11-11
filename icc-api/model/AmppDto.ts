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
import { AmppComponentDto } from "./AmppComponentDto"
import { AtcDto } from "./AtcDto"
import { CommercializationDto } from "./CommercializationDto"
import { CompanyDto } from "./CompanyDto"
import { DmppDto } from "./DmppDto"
import { QuantityDto } from "./QuantityDto"
import { SamText } from "./SamText"
import { SamTextDto } from "./SamTextDto"
import { SupplyProblemDto } from "./SupplyProblemDto"

import { decodeBase64 } from "./ModelHelper"

export class AmppDto {
  constructor(json: JSON | any) {
    Object.assign(this as AmppDto, json)
  }

  from?: number
  to?: number
  index?: number
  ctiExtended?: string
  orphan?: boolean
  leafletLink?: SamTextDto
  spcLink?: SamTextDto
  rmaPatientLink?: SamTextDto
  rmaProfessionalLink?: SamTextDto
  parallelCircuit?: number
  parallelDistributor?: string
  packMultiplier?: number
  packAmount?: QuantityDto
  packDisplayValue?: string
  status?: AmppDto.StatusEnum
  atcs?: Array<AtcDto>
  crmLink?: SamTextDto
  deliveryModusCode?: string
  deliveryModus?: SamTextDto
  deliveryModusSpecification?: SamTextDto
  dhpcLink?: SamText
  distributorCompany?: CompanyDto
  singleUse?: boolean
  speciallyRegulated?: number
  abbreviatedName?: SamTextDto
  prescriptionName?: SamTextDto
  note?: SamTextDto
  posologyNote?: SamTextDto
  noGenericPrescriptionReasons?: Array<SamTextDto>
  exFactoryPrice?: number
  reimbursementCode?: number
  definedDailyDose?: QuantityDto
  officialExFactoryPrice?: number
  realExFactoryPrice?: number
  pricingInformationDecisionDate?: number
  components?: Array<AmppComponentDto>
  commercializations?: Array<CommercializationDto>
  supplyProblems?: Array<SupplyProblemDto>
  dmpps?: Array<DmppDto>
  vaccineIndicationCodes?: Array<string>
}
export namespace AmppDto {
  export type StatusEnum = "AUTHORIZED" | "SUSPENDED" | "REVOKED"
  export const StatusEnum = {
    AUTHORIZED: "AUTHORIZED" as StatusEnum,
    SUSPENDED: "SUSPENDED" as StatusEnum,
    REVOKED: "REVOKED" as StatusEnum
  }
}
