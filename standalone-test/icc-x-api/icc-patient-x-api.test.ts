import { assert } from 'chai'
import 'isomorphic-fetch'
import { before } from 'mocha'
import { Patient } from '../../icc-api/model/Patient'
import { Api } from '../../icc-x-api'
import { ICURE_URL, USER, USER_PASSWORD, USER_USERNAME } from '../standalone-test.env'
import { initSecuredCrypto, loadPrivateKeys } from '../utils/standalone-test-utils'

const { v4: uuid } = require('uuid')

const isoCrypto = require('../setup/support/msrCrypto')

let api: any

before(async () => {
  await initSecuredCrypto(isoCrypto)
  api = Api(ICURE_URL, USER_USERNAME, USER_PASSWORD, isoCrypto)
})

describe('icc-x-patient-api Tests', () => {
  it('CreatePatientWithUser Success for HCP', async () => {
    // Given
    const { userApi: userApiForHcp, patientApi: patientApiForHcp } = api

    const hcpUser = await userApiForHcp.getCurrentUser()
    await loadPrivateKeys(api, USER)

    const patientToCreate = await patientApiForHcp.newInstance(
      hcpUser,
      new Patient({
        id: uuid(),
        firstName: 'John',
        lastName: 'Snow',
        note: 'Winter is coming',
      })
    )

    // When
    const createdPatient = await patientApiForHcp.createPatientWithUser(hcpUser, patientToCreate)

    // Then
    const readPatient = await patientApiForHcp.getPatientWithUser(hcpUser, createdPatient.id!)
    assert(readPatient != null)
    assert(readPatient.id != null)
    assert(readPatient.note == patientToCreate.note)
    assert(readPatient.firstName == patientToCreate.firstName)
    assert(readPatient.lastName == patientToCreate.lastName)
    assert(readPatient.delegations[hcpUser.healthcarePartyId!].length > 0)
    assert(readPatient.encryptionKeys[hcpUser.healthcarePartyId!].length > 0)
  })
})
