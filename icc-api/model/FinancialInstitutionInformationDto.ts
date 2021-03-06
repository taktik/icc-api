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

/**
 * Financial information (Bank, bank account) used to reimburse the patient.
 */
import { decodeBase64 } from "./ModelHelper"

export class FinancialInstitutionInformationDto {
  constructor(json: JSON | any) {
    Object.assign(this as FinancialInstitutionInformationDto, json)
  }

  name?: string
  key?: string
  bankAccount?: string
  bic?: string
  proxyBankAccount?: string
  proxyBic?: string
  preferredFiiForPartners?: Array<string>
  /**
   * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
   */
  encryptedSelf?: string
}
