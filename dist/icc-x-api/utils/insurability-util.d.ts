import { PatientDto, InsurabilityDto } from "../../icc-api/model/models"
export declare function isBIM(ct1: number | string, ct2: number | string): boolean
export declare function patientIsBIM(patient: PatientDto): boolean
export declare function isPatientPaymentByIo(patient: PatientDto): boolean
/**
 * Returns the titulary id from patient insurability
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
export declare function getMembership(patient: PatientDto): string
/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
export declare function getInsurability(patient: PatientDto): InsurabilityDto
/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient
 */
export declare function isPatientHospitalized(patient: PatientDto): boolean
