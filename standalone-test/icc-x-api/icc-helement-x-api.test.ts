import { assert } from 'chai'
import 'isomorphic-fetch'
import { before } from 'mocha'
import { Code } from '../../icc-api/model/Code'
import { HealthElement } from '../../icc-api/model/HealthElement'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { Api, IccHelementXApi, IccPatientXApi } from '../../icc-x-api'
import { ICURE_URL, USER_PASSWORD, USER_USERNAME } from '../standalone-test.env'
import { initSecuredCrypto, loadPrivateKeys } from '../utils/standalone-test-utils'

const { v4: uuid } = require('uuid')

const isoCrypto = require('../setup/support/msrCrypto')

before(async () => {
  await initSecuredCrypto(isoCrypto)
})

async function createPatient(patientApiForHcp: IccPatientXApi, hcpUser: User) {
  return patientApiForHcp.createPatientWithUser(
    hcpUser,
    await patientApiForHcp.newInstance(
      hcpUser,
      new Patient({
        id: uuid(),
        firstName: 'John',
        lastName: 'Snow',
        note: 'Winter is coming',
      })
    )
  )
}

function healthElementToCreate(hElementApiForHcp: IccHelementXApi, hcpUser: User, patient: Patient) {
  return hElementApiForHcp.newInstance(
    hcpUser,
    patient,
    new HealthElement({
      id: uuid(),
      codes: [new Code({ system: 'LOINC', code: '95209', version: '3' })],
      note: 'SARS-V2',
    }),
    true
  )
}

describe('icc-helement-x-api Tests', () => {
  it('CreateHealthElementWithUser Success for HCP', async () => {
    // Given
    const api = Api(ICURE_URL, USER_USERNAME, USER_PASSWORD, isoCrypto)

    const { userApi: userApiForHcp, patientApi: patientApiForHcp, healthcareElementApi: hElementApiForHcp } = api

    const hcpUser = await userApiForHcp.getCurrentUser()
    await loadPrivateKeys(api, hcpUser)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const hElementToCreate = await healthElementToCreate(hElementApiForHcp, hcpUser, patient)

    // When
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(hcpUser, hElementToCreate)

    // Then
    const readHealthElement = await hElementApiForHcp.getHealthElementWithUser(hcpUser, createdHealthElement.id!)
    assert(readHealthElement != null)
    assert(readHealthElement.id != null)
    assert(readHealthElement.note == hElementToCreate.note)
    assert(readHealthElement.delegations![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.encryptionKeys![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.cryptedForeignKeys![hcpUser.healthcarePartyId!].length > 0)
  })

  it('ModifyHealthElementWithUser Success for HCP', async () => {
    // Given
    const api = Api(ICURE_URL, USER_USERNAME, USER_PASSWORD, isoCrypto)
    const { userApi: userApiForHcp, patientApi: patientApiForHcp, healthcareElementApi: hElementApiForHcp } = api

    const hcpUser = await userApiForHcp.getCurrentUser()
    await loadPrivateKeys(api, hcpUser)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(
      hcpUser,
      await healthElementToCreate(hElementApiForHcp, hcpUser, patient)
    )

    // When
    const modifiedHealthElement = await hElementApiForHcp.modifyHealthElementWithUser(hcpUser, {
      ...createdHealthElement,
      note: 'SARS-V2 (COVID-19)',
    })

    // Then
    const readHealthElement = await hElementApiForHcp.getHealthElementWithUser(hcpUser, createdHealthElement.id!)
    assert(readHealthElement != null)
    assert(readHealthElement.id != null)
    assert(readHealthElement.note != createdHealthElement.note)
    assert(readHealthElement.note == modifiedHealthElement.note)
    assert(readHealthElement.delegations![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.encryptionKeys![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.cryptedForeignKeys![hcpUser.healthcarePartyId!].length > 0)
  })

  it('findHealthElementsByHCPartyAndPatientWithUser Success for HCP', async () => {
    // Given
    const api = Api(ICURE_URL, USER_USERNAME, USER_PASSWORD, isoCrypto)
    const { userApi: userApiForHcp, patientApi: patientApiForHcp, healthcareElementApi: hElementApiForHcp } = api

    const hcpUser = await userApiForHcp.getCurrentUser()
    await loadPrivateKeys(api, hcpUser)

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(
      hcpUser,
      await healthElementToCreate(hElementApiForHcp, hcpUser, patient)
    )

    // When
    /*
    const foundHealthElements = await hElementApiForHcp.findHealthElementsByHCPartyAndPatientWithUser(hcpUser, hcpUser.healthcarePartyId!, patient)

    console.log('foundHealthElements : ', foundHealthElements)

    // Then
    assert(foundHealthElements.length == 1)
    assert(foundHealthElements[0].id == createdHealthElement.id)
    */
  })
})
