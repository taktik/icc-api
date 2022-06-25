/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from '../../icc-api/model/AbstractFilterPatient'
import { Patient } from '../../icc-api/model/Patient'

export class PatientByHcPartyGenderEducationProfession extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)

    super(json)
  }

  healthcarePartyId?: string
  gender?: Patient.GenderEnum
  education?: string
  profession?: string

  $type = 'PatientByHcPartyGenderEducationProfession'
}
