/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from "../../icc-api/model/AbstractFilterPatient"

export class PatientByHcPartyDateOfBirthBetweenFilter extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)
  }

  healthcarePartyId?: string
  minDateOfBirth?: number
  maxDateOfBirth?: number

  $type: string = "PatientByHcPartyDateOfBirthBetweenFilter"
}
