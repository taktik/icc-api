import { HealthcarePartyDto } from "../../icc-api/model/models"
export interface KendoDropdownSpeciality {
  text: string
  value: string
}
export declare const SPECIALITIES: Array<string>
/**
 * Translation keys for specialities.
 * @see SPECIALITIES
 */
export declare const SPECIALITIES_KEYS: {
  [spec: string]: string
}
export declare function isDoctor(nihii: string): boolean
export declare function isDoctorAssistant(nihii: string): boolean
export declare function getPhoneNumber(
  hcp: HealthcarePartyDto,
  maxLength: number | undefined
): number | null
