import * as _ from "lodash"
import { HealthcarePartyDto } from "../../../icc-api/model/models"
import { Telecom } from "fhc-api/dist/model/Telecom"

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

export function getPhoneNumber(hcp: HealthcarePartyDto): number | null {
  const phoneNumbers = (hcp.addresses || []).map(a => {
    const t = (a.telecoms || []).find(
      (t: Telecom) =>
        t.telecomType === Telecom.TelecomTypeEnum.Phone ||
        t.telecomType === Telecom.TelecomTypeEnum.Mobile
    )
    return t && Number(t.telecomNumber)
  })

  return (!phoneNumbers.length || _.isNaN(phoneNumbers[0]) ? null : phoneNumbers[0]) || null
}
