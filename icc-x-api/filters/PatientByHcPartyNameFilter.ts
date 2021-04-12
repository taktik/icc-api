/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from "../../icc-api/model/AbstractFilterPatient"

export class PatientByHcPartyNameFilter extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)
  }

  healthcarePartyId?: string
  name?: String

  $type: string = "PatientByHcPartyNameFilter"
}
