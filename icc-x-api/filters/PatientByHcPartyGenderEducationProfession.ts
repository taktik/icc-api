/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from '../../icc-api/model/AbstractFilterPatient'
import { Patient } from '../../icc-api/model/Patient'
import GenderEnum = Patient.GenderEnum

export class PatientByHcPartyGenderEducationProfession extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)
  }

  healthcarePartyId?: string
  gender?: GenderEnum
  education?: string
  profession?: string

  $type = 'PatientByHcPartyGenderEducationProfession'
}
