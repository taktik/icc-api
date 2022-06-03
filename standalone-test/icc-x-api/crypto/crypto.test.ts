import { expect } from 'chai'
import * as _ from 'lodash'
import 'mocha'
import { HealthcareParty } from '../../../icc-api/model/models'
import { Patient } from '../../../icc-api/model/Patient'
import { Api } from '../../../icc-x-api'
import { ICURE_URL, USER_PASSWORD, USER_USERNAME } from '../../standalone-test.env'
import { initSecuredCrypto, loadPrivateKeys } from '../../utils/standalone-test-utils'

const isoCrypto = require('../../setup/support/msrCrypto')

let api: any

before(async () => {
  await initSecuredCrypto(isoCrypto)
  api = Api(ICURE_URL, USER_USERNAME, USER_PASSWORD, isoCrypto)
})

describe('Create a patient from scratch', () => {
  it('The HCP private and public keys should match', async () => {
    const user = await api.userApi.getCurrentUser()
    await loadPrivateKeys(api, user)

    var defaultHcp: HealthcareParty | null = null
    var error: any | null = null

    try {
      defaultHcp = await api.healthcarePartyApi.getCurrentHealthcareParty()
    } catch (e) {
      error = e
    }

    expect(error).to.not.exist
    expect(defaultHcp!!).to.exist
    expect(defaultHcp!!.publicKey).to.exist

    const validKeyPair = await api.cryptoApi.checkPrivateKeyValidity(defaultHcp!!)
    expect(validKeyPair).to.equal(true)
  })

  it('should create a patient in the database', async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      await loadPrivateKeys(api, user)

      const patient = await api.patientApi.createPatientWithUser(
        user,
        await api.patientApi.newInstance(
          user,
          new Patient({
            lastName: 'Biden',
            firstName: 'Joe',
            note: 'A secured note that is encrypted',
          })
        )
      )

      const fetched = await api.patientApi.getPatientWithUser(user, patient.id)

      expect(patient.id).to.equal(fetched.id)
      expect(patient.firstName).to.equal(fetched.firstName)
      expect(patient.lastName).to.equal(fetched.lastName)
      expect(patient.note).to.equal(fetched.note)
      expect(patient.encryptedSelf).to.equal(fetched.encryptedSelf)
    } catch (e) {
      console.log(e)
    }
  })
})

describe('Init confidential delegation in patient', () => {
  it('should return a patient with a confidential delegation', async () => {
    try {
      const user = await api.userApi.getCurrentUser()
      await loadPrivateKeys(api, user)

      const pat = await api.patientApi.newInstance(user, { firstName: 'John', lastName: 'Doe' })
      await api.patientApi.initConfidentialDelegation(pat, user)

      const confidentialDelegationKey = await api.cryptoApi.extractPreferredSfk(pat, user.healthcarePartyId!, true)

      const nonConfidentialDelegationKey = await api.cryptoApi.extractPreferredSfk(pat, user.healthcarePartyId!, false)

      expect(confidentialDelegationKey === nonConfidentialDelegationKey).to.equal(false)
    } catch (e) {
      console.log(e)
    }
  })
})

// describe("Test that patient information can be decrypted", () => {
//   it("should return a contact with decrypted information", async () => {
//     try {
//       const user = await api.userApi.getCurrentUser()
//       await loadPrivateKeys(api, user)

//       const pat = await api.patientApi.getPatientWithUser(
//         user,
//         "Pat_2015022022080888491_ms-gerard-delacroix-prd-10c50a01-5670-477b-a4a1-e6bb737325ce"
//       )

//       expect(pat.delegations).to.not.empty

//       const contacts = await api.contactApi.findBy(user.healthcarePartyId!, pat)
//       const hes = await api.healthcareElementApi.findBy(user.healthcarePartyId!, pat)

//       expect(contacts).to.not.empty
//       expect(hes).to.not.empty
//     } catch (e) {
//       console.log(e)
//     }
//   })
// })

describe('Test that contact information can be decrypted', () => {
  it('should return a contact with decrypted information', async () => {
    const simpleServiceId = api.cryptoApi.randomUuid()
    const compoundServiceId = api.cryptoApi.randomUuid()
    try {
      const user = await api.userApi.getCurrentUser()
      await loadPrivateKeys(api, user)

      const pat = await api.patientApi.createPatientWithUser(user, await api.patientApi.newInstance(user, { firstName: 'Bill', lastName: 'Clinton' }))
      const ctc = await api.contactApi.createContactWithUser(
        user,
        await api.contactApi.newInstance(user, pat, {
          services: [
            {
              id: simpleServiceId,
              content: { fr: { stringValue: 'Salut' }, nl: { stringValue: 'Halo' } },
            },
            {
              id: compoundServiceId,
              content: {
                fr: {
                  compoundValue: [{ content: { fr: { stringValue: 'Salut' } } }, { content: { fr: { stringValue: 'à toi' } } }],
                },
                nl: {
                  compoundValue: [{ content: { fr: { stringValue: 'Halo' } } }, { content: { fr: { stringValue: 'allemaal' } } }],
                },
              },
            },
          ],
        })
      )
      const check = await api.contactApi.getContactWithUser(user, ctc.id)

      const simpleService: any = _.find(check.services, { id: simpleServiceId })
      const compoundService: any = _.find(check.services, { id: compoundServiceId })

      const simpleServiceCtc: any = _.find(ctc.services, { id: simpleServiceId })
      const compoundServiceCtc: any = _.find(ctc.services, { id: compoundServiceId })

      expect(simpleService.content.fr.stringValue).to.equal(simpleServiceCtc.content.fr.stringValue)
      expect(simpleService.content.nl.stringValue).to.equal(simpleServiceCtc.content.nl.stringValue)
      expect(simpleService.encryptedSelf).to.not.be.null

      expect(compoundService.content.fr.compoundValue[0].content.fr.stringValue).to.equal(
        compoundServiceCtc.content.fr.compoundValue[0].content.fr.stringValue
      )
      expect(compoundService.content.fr.compoundValue[0].encryptedSelf).to.not.be.null

      expect(compoundService.content.fr.compoundValue[1].content.fr.stringValue).to.equal(
        compoundServiceCtc.content.fr.compoundValue[1].content.fr.stringValue
      )
      expect(compoundService.content.fr.compoundValue[1].encryptedSelf).to.not.be.null
    } catch (e) {
      console.log(e)
      throw e
    }
  })
})

// describe('test that confidential helement information cannot be retrieved at MH level', () => {
//   it('should find the confidential data only when logged as the user', async () => {
//     try {
//       const user = await api.userApi.getCurrentUser()
//       const mhUser = await mhapi.userApi.getCurrentUser()
//       await loadPrivateKeys(api, user)
//       await loadPrivateKeys(mhapi, mhUser)

//       const pat = await api.patientApi.newInstance(user, { firstName: 'John', lastName: 'Doe' })
//       const modifiedPatient = (await api.patientApi.initConfidentialDelegation(pat, user))!!

//       await api.healthcareElementApi.createHealthElement(
//         await api.healthcareElementApi.newInstance(user, modifiedPatient, { descr: 'Confidential info' }, true)
//       )

//       const retrievedHesAsUser = await api.healthcareElementApi.findBy(user.healthcarePartyId!, modifiedPatient)
//       const retrievedHesAsMh = await mhapi.healthcareElementApi.findBy(mhUser.healthcarePartyId!, modifiedPatient)

//       expect(retrievedHesAsUser.length).to.equal(1, 'User should see its confidential data')
//       expect(retrievedHesAsMh.length).to.equal(0, 'MH should not see confidential data')
//     } catch (e) {
//       console.log(e)
//     }
//   })
// })

// describe("test that confidential contact information cannot be retrieved at MH level", () => {
//   it("should find the confidential data only when logged as the user", async () => {
//     try {
//       const user = await api.userApi.getCurrentUser()
//       const mhUser = await mhapi.userApi.getCurrentUser()
//       await loadPrivateKeys(api, user)
//       await loadPrivateKeys(mhapi, mhUser)

//       const pat = await api.patientApi.newInstance(user, { firstName: "John", lastName: "Doe" })
//       const modifiedPatient = (await api.patientApi.initConfidentialDelegation(pat, user))!!

//       await api.contactApi.createContactWithUser(
//         user,
//         await api.healthcareElementApi.newInstance(
//           user,
//           modifiedPatient,

//           { descr: "Confidential info", services: [], subContacts: [] },
//           true
//         )
//       )

//       await api.contactApi.createContactWithUser(
//         user,
//         await api.healthcareElementApi.newInstance(
//           user,
//           modifiedPatient,

//           { descr: "Non confidential info", services: [], subContacts: [] },
//           false
//         )
//       )

//       const retrievedCtcsAsUser = await api.contactApi.findBy(
//         user.healthcarePartyId!,
//         modifiedPatient
//       )
//       const retrievedCtcsAsMh = await mhapi.contactApi.findBy(
//         mhUser.healthcarePartyId!,
//         modifiedPatient
//       )

//       expect(retrievedCtcsAsUser.length).to.equal(2, "User should see its confidential data")
//       expect(retrievedCtcsAsMh.length).to.equal(1, "MH should not see confidential data")
//     } catch (e) {
//       console.log(e)
//     }
//   })
// })
