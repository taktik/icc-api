"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const fhc_api_1 = require("fhc-api")
const _ = require("lodash")
function toPatient(patientDto) {
  const patient = new fhc_api_1.Patient(patientDto)
  _.each(patient.insurabilities, ins => {
    ins.parameters = _.pick(ins.parameters, [
      "status",
      "tc1",
      "tc2",
      "preferentialstatus",
      "chronicaldisease",
      "paymentapproval"
    ])
  })
  return patient
}
exports.toPatient = toPatient
//# sourceMappingURL=fhc-patient-util.js.map
