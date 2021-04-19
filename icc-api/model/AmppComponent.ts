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
import { DeviceType } from "./DeviceType"
import { PackagingType } from "./PackagingType"

export class AmppComponent {
  constructor(json: JSON | any) {
    Object.assign(this as AmppComponent, json)
  }

  from?: number
  to?: number
  contentType?: AmppComponent.ContentTypeEnum
  contentMultiplier?: number
  packSpecification?: string
  deviceType?: DeviceType
  packagingType?: PackagingType
}
export namespace AmppComponent {
  export type ContentTypeEnum = "ACTIVE_COMPONENT" | "SOLVENT" | "DEVICE" | "EXCIPIENT"
  export const ContentTypeEnum = {
    ACTIVECOMPONENT: "ACTIVE_COMPONENT" as ContentTypeEnum,
    SOLVENT: "SOLVENT" as ContentTypeEnum,
    DEVICE: "DEVICE" as ContentTypeEnum,
    EXCIPIENT: "EXCIPIENT" as ContentTypeEnum
  }
}