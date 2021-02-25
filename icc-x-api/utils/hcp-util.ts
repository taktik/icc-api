import * as _ from "lodash"
import { HealthcarePartyDto, TelecomDtoEmbed } from "../../icc-api/model/models"

export interface KendoDropdownSpeciality {
  text: string
  value: string
}

export const SPECIALITIES: Array<string> = [
  "ADMINISTRATION",
  "CARE_GIVER",
  "ANATOMOPATHOLOGY",
  "ANESTHESIOLOGY",
  "SOCIAL_WORKER",
  "PHARMA_ASSISTANT",
  "AUDIOLOGIST",
  "BACTERIOLOGY",
  "TRUSS_ORTHOTIST",
  "CLINICAL_BIOLOGY",
  "CARDIOLOGY",
  "GENERAL_SURGERY",
  "MAXILLOFACIAL_SURGERY",
  "PLASTIC_SURGERY",
  "STOMATOLOGICAL_SURGERY",
  "CARDIOVASCULAR_SURGERY",
  "DENTISTRY",
  "DERMATOLOGY",
  "DIETETIC",
  "ENDOCRINOLOGY",
  "OCCUPATIONAL_THERAPIST",
  "GASTROENTEROLOGY",
  "GENETIC",
  "GERIATRICS",
  "GYNECOLOGY",
  "HEMATOLOGY",
  "NURSE",
  "NURSE_EDUCATOR",
  "PHYSIOTHERAPY",
  "SPEECH",
  "ACUTE_MEDICINE",
  "GENERAL_MEDICINE",
  "INTERNAL_MEDICINE",
  "NUCLEAR_MEDICINE",
  "PHYSICAL_MEDICINE",
  "NEONATOLOGY",
  "NEPHROLOGY",
  "NEUROSURGERY",
  "NEUROLOGY",
  "NEUROPEDIATRICS",
  "NEUROPSYCHIATRY",
  "NUTRITIONIST",
  "ONCOLOGY",
  "OPHTHALMOLOGY",
  "ORTHOPEDICS",
  "ORTHOPTISTE",
  "OTORHINOLARYNGOLOGY",
  "PEDIATRICS",
  "PHARMACOLOGY",
  "RESPIRATORY",
  "PODIATRIST",
  "PUBLIC_HEALTH_PREVENTION",
  "PROSTHETIST",
  "PSYCHIATRY",
  "MEDICAL_PSYCHOLOGY",
  "RADIODIAGNOSTICS",
  "RADIOTHERAPY",
  "RESUSCITATION",
  "RHEUMATOLOGY",
  "MIDWIFE",
  "STOMATOLOGY",
  "EMERGENCY",
  "UROLOGY",
  "TOXICOLOGY",
  "TRANSPORT"
]

/**
 * Translation keys for specialities.
 * @see SPECIALITIES
 */
export const SPECIALITIES_KEYS: { [spec: string]: string } = _.fromPairs(
  SPECIALITIES.map(spec => [spec, "hcp-form.SPECIALITIES." + spec])
)

export function isDoctor(nihii: string): boolean {
  return (
    !!nihii &&
    nihii.length === 11 &&
    nihii.startsWith("1") &&
    !nihii.endsWith("005") &&
    !nihii.endsWith("006")
  )
}

export function isDoctorAssistant(nihii: string): boolean {
  return (
    !!nihii &&
    nihii.length === 11 &&
    nihii.startsWith("1") &&
    nihii.endsWith("005") &&
    nihii.endsWith("006")
  )
}

export function getPhoneNumber(
  hcp: HealthcarePartyDto,
  maxLength: number | undefined
): number | null {
  const phoneNumbers = (hcp.addresses || []).map(a => {
    const t = (a.telecoms || []).find(
      (t: TelecomDtoEmbed) =>
        t.telecomType === TelecomDtoEmbed.TelecomTypeEnum.Phone ||
        t.telecomType === TelecomDtoEmbed.TelecomTypeEnum.Mobile
    )
    let res = t && t.telecomNumber
    if (res && maxLength) {
      while (res.length > maxLength) {
        if (res.startsWith("0032")) {
          res = "0" + res.substr(4)
        } else if (res.startsWith("+32")) {
          res = "0" + res.substr(3)
        } else if (res.startsWith("32")) {
          res = "0" + res.substr(2)
        } else if (res.startsWith("00")) {
          res = res.substr(2)
        } else if (res.startsWith("0")) {
          res = res.substr(1)
        } else if (res.startsWith("352")) {
          res = "0" + res.substr(3)
        } else if (res.startsWith("33")) {
          res = "0" + res.substr(2)
        } else {
          res = res.substr(1)
        }
      }
    }
    return res && Number(res)
  })

  return (!phoneNumbers.length || _.isNaN(phoneNumbers[0]) ? null : phoneNumbers[0]) || null
}
