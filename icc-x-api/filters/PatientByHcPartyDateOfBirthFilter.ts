/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from "../../icc-api/model/AbstractFilterPatient"

export class PatientByHcPartyDateOfBirthFilter extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)
  }

  healthcarePartyId?: string
  dateOfBirth?: number

  $type: string = "PatientByHcPartyDateOfBirthFilter"
}
