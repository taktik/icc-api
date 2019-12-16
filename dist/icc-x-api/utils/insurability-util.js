"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const _ = require("lodash")
function isBIM(ct1, ct2) {
  //BIM if ct1 ood and ct2 ood
  return +ct1 % 2 !== 0 && +ct2 % 2 !== 0
}
exports.isBIM = isBIM
function patientIsBIM(patient) {
  // FIXME this doesn't check the date of the insurability. It is related to the idea of having only on insurability at a time.
  return isBIM(
    _.get(patient, "insurabilities[0].parameters.tc1"),
    _.get(patient, "insurabilities[0].parameters.tc2")
  )
}
exports.patientIsBIM = patientIsBIM
function isPatientPaymentByIo(patient) {
  const paymentByIo = _.get(patient, "insurabilities[0].parameters.paymentByIo")
  return paymentByIo === "true"
}
exports.isPatientPaymentByIo = isPatientPaymentByIo
/**
 * Returns the titulary id from patient insurability
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
function getMembership(patient) {
  const ioCode = _.get(patient, "insurabilities[0].identificationNumber")
  if (_.isUndefined(ioCode)) {
    // TODO translate
    throw new Error("Le patient n'a pas de données d'assurabilité")
  }
  return ioCode
}
exports.getMembership = getMembership
/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
function getInsurability(patient) {
  const insurability = _.get(patient, "insurabilities[0]")
  if (_.isUndefined(insurability)) {
    // TODO translate
    throw new Error("Le patient n'a pas de données d'assurabilité")
  }
  return insurability
}
exports.getInsurability = getInsurability
/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient
 */
function isPatientHospitalized(patient) {
  return getInsurability(patient).hospitalisation || false
}
exports.isPatientHospitalized = isPatientHospitalized
//# sourceMappingURL=insurability-util.js.map
