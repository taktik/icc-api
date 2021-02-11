import { PatientDto } from "../../icc-api/model/models"
import { Patient } from "@taktik/fhc-api"
import * as _ from "lodash"

export function toPatient(patientDto: PatientDto): Patient {
  const patient = new Patient(patientDto)
  _.each(patient.insurabilities, ins => {
    ins.parameters = _.pick(ins.parameters, [
      "status",
      "tc1",
      "tc2",
      "preferentialstatus",
      "chronicaldisease",
      "paymentapproval"
    ]) as { [key: string]: string }
  })
  return patient
}
