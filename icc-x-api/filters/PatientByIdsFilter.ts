/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from '../../icc-api/model/AbstractFilterPatient'

export class PatientByIdsFilter extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)
  }

  healthcarePartyId?: string
  ids?: string[]

  $type = 'PatientByIdsFilter'
}
