import _ from "lodash"
import { PatientDto, InsurabilityDto } from "../../icc-api/model/models"

export function isBIM(ct1: number | string, ct2: number | string): boolean {
  //BIM if ct1 ood and ct2 ood
  return +ct1 % 2 !== 0 && +ct2 % 2 !== 0
}

export function patientIsBIM(patient: PatientDto) {
  // FIXME this doesn't check the date of the insurability. It is related to the idea of having only on insurability at a time.
  return isBIM(
    _.get(patient, "insurabilities[0].parameters.tc1"),
    _.get(patient, "insurabilities[0].parameters.tc2")
  )
}

export function isPatientPaymentByIo(patient: PatientDto) {
  const paymentByIo = _.get(patient, "insurabilities[0].parameters.paymentByIo")
  return paymentByIo === "true"
}

/**
 * Returns the titulary id from patient insurability
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
export function getMembership(patient: PatientDto): string {
  const ioCode = _.get(patient, "insurabilities[0].membership")
  if (_.isUndefined(ioCode)) {
    // TODO translate
    throw new Error("Le patient n'a pas de données d'assurabilité")
  }
  return ioCode
}

/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
export function getInsurability(patient: PatientDto): InsurabilityDto {
  const insurability = _.get(patient, "insurabilities[0]")
  if (_.isUndefined(insurability)) {
    // TODO translate
    throw new Error("Le patient n'a pas de données d'assurabilité")
  }
  return insurability
}

/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient
 */
export function isPatientHospitalized(patient: PatientDto): boolean {
  const hosp = _.get(patient, "insurabilities[0].hospitalisation")
  if (_.isUndefined(hosp)) {
    // TODO translate
    throw new Error("Le patient n'a pas de données d'assurabilité")
  }
  return hosp
}
