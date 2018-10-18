import { PatientDto, HealthcarePartyDto } from "../../icc-api/model/models"
import { Patient } from "fhc-api/dist/model/models"
import * as _ from "lodash"

export function toPatient(patientDto: PatientDto): Patient {
  const patient = new Patient(patientDto)
  patient.gender = mapGender(patientDto.gender)
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

function mapGender(gender: string): Patient.GenderEnum {
  // Male = <any>"male",
  // Female = <any>"female",
  // Unknown = <any>"unknown",
  // Indeterminate = <any>"indeterminate",
  // Changed = <any>"changed",
  // ChangedToMale = <any>"changedToMale",
  // ChangedToFemale = <any>"changedToFemale"
  switch (gender) {
    case "male":
      return Patient.GenderEnum.M
    case "female":
      return Patient.GenderEnum.F
    default:
      return Patient.GenderEnum.M
  }
}
