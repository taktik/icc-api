/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from "../../icc-api/model/AbstractFilterPatient"

export class PatientByHcPartyAndActiveFilter extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)
  }

  healthcarePartyId?: string
  active: boolean = false

  $type: string = "PatientByHcPartyAndActiveFilter"
}
