import { assert } from 'chai'
import 'isomorphic-fetch'
import { before } from 'mocha'
import { Code } from '../../icc-api/model/Code'
import { Contact } from '../../icc-api/model/Contact'
import { Content } from '../../icc-api/model/Content'
import { FilterChainService } from '../../icc-api/model/FilterChainService'
import { HealthElement } from '../../icc-api/model/HealthElement'
import { Patient } from '../../icc-api/model/Patient'
import { Service } from '../../icc-api/model/Service'
import { ServiceLink } from '../../icc-api/model/ServiceLink'
import { SubContact } from '../../icc-api/model/SubContact'
import { User } from '../../icc-api/model/User'
import { Api, IccContactXApi, IccHelementXApi, IccPatientXApi } from '../../icc-x-api'
import { ServiceByHcPartyHealthElementIdsFilter } from '../../icc-x-api/filters/ServiceByHcPartyHealthElementIdsFilter'
import { ICURE_URL, USER, USER_PASSWORD, USER_USERNAME } from '../standalone-test.env'
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

async function createHealthElement(healthElementApi: IccHelementXApi, hcpUser: User, patient: Patient) {
  return healthElementApi.createHealthElementWithUser(
    hcpUser,
    await healthElementApi.newInstance(
      hcpUser,
      patient,
      new HealthElement({
        id: uuid(),
        note: 'My secret note',
        tags: [
          new Code({
            id: 'ICURE|MY-CODE|1',
            code: 'MY-CODE',
            type: 'ICURE',
            version: '1',
          }),
        ],
      }),
      true
    )
  )
}

function createBasicContact(contactApiForHcp: IccContactXApi, hcpUser: User, patient: Patient) {
  return contactApiForHcp.newInstance(
    hcpUser,
    patient,
    new Contact({
      id: uuid(),
      services: [
        contactApiForHcp.service().newInstance(
          hcpUser,
          new Service({
            id: uuid(),
            valueDate: 20220203111034,
            content: { en: new Content({ numberValue: 53.5 }) },
            tags: [
              new Code({
                id: 'LOINC|29463-7|2',
                code: '29463-7',
                type: 'LOINC',
                version: '2',
              }),
            ],
          })
        ),
      ],
      descr: 'Weight value',
    }),
    true
  )
}

describe('icc-x-contact-api Tests', () => {
  it('CreateContactWithUser Success for HCP', async () => {
    // Given
    const api = Api(ICURE_URL, USER_USERNAME, USER_PASSWORD, isoCrypto)
    const { userApi: userApiForHcp, patientApi: patientApiForHcp, contactApi: contactApiForHcp } = api

    const hcpUser = await userApiForHcp.getCurrentUser()
    await loadPrivateKeys(api, USER)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const contactToCreate = await createBasicContact(contactApiForHcp, hcpUser, patient)

    // When
    const createdContact = (await contactApiForHcp.createContactWithUser(hcpUser, contactToCreate)) as Contact

    // Then
    const readContact = await contactApiForHcp.getContactWithUser(hcpUser, createdContact.id!)
    assert(readContact != null)
    assert(readContact.openingDate != null)
    assert(readContact.groupId != null)
    assert(readContact.responsible == hcpUser.healthcarePartyId)
    assert(readContact.id == contactToCreate.id)
    assert(readContact.descr == contactToCreate.descr)
    assert(readContact.delegations[hcpUser.healthcarePartyId!].length > 0)
    assert(readContact.encryptionKeys[hcpUser.healthcarePartyId!].length > 0)
    assert(readContact.services[0].responsible == hcpUser.healthcarePartyId)
    assert(readContact.services[0].id == contactToCreate.services![0].id)
    assert(readContact.services[0].valueDate == contactToCreate.services![0].valueDate!)
    assert(readContact.services[0].tags[0].id == contactToCreate.services![0].tags![0].id!)
  })

  it('Filter Services By HealthElementId - Success', async () => {
    // Given
    const api = Api(ICURE_URL, USER_USERNAME, USER_PASSWORD, isoCrypto)
    const { userApi: userApiForHcp, patientApi: patientApiForHcp, contactApi: contactApiForHcp, healthcareElementApi: hElementApiForHcp } = api

    const hcpUser = await userApiForHcp.getCurrentUser()
    await loadPrivateKeys(api, USER)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const healthElement = await createHealthElement(hElementApiForHcp, hcpUser, patient)

    const contactToCreate = await createBasicContact(contactApiForHcp, hcpUser, patient).then((contact) => {
      return {
        ...contact,
        subContacts: [
          new SubContact({
            id: uuid(),
            healthElementId: healthElement!.id!,
            services: [new ServiceLink({ serviceId: contact.services![0].id })],
          }),
        ],
      }
    })

    const createdContact = (await contactApiForHcp.createContactWithUser(hcpUser, contactToCreate)) as Contact
    assert(createdContact != null)

    // When
    /*
    const foundServices = await contactApiForHcp.filterServicesBy(
      undefined,
      undefined,
      new FilterChainService({
        filter: new ServiceByHcPartyHealthElementIdsFilter({
          healthcarePartyId: hcpUser.healthcarePartyId!,
          healthElementIds: [healthElement!.id!],
        }),
      })
    )

    // Then

    assert(foundServices.rows!.length == 1)
    assert(foundServices.rows![0].id == createdContact.services![0].id)
    assert(foundServices.rows![0].healthElementsIds!.find((heId) => heId == healthElement!.id!) != undefined)
    */
  })
})
