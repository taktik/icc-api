/**
 * In order to interact with the iCure backend we need to work with an existing user.
 * The user can be local (present in your local db) or in the cloud.
 *
 * Note that without a valid user, no interaction with iCure is possible (localy or remotely).
 */

import { expect } from 'chai'
import fetch from 'node-fetch'
import { HealthcareParty } from '../icc-api/model/models'
import { User } from '../icc-api/model/User'
import { Api } from '../icc-x-api'

//  Expose fetch globally
;(global as any).fetch = fetch

const DEFAULT_USER = require('./setup/content/user.json')
const DEFAULT_HCP = require('./setup/content/hcp.json')
const DEFAULT_PARENT = require('./setup/content/parent.json')

const api = Api('http://localhost:16043/rest/v1', 'demo-test-1608210888', 'test')

describe('Do the test default objects exist in the local DB ?', () => {
  it('It should be possible to grab the current user from the local server', async () => {
    let defaultUser: User | null = null
    let error: any | null = null

    try {
      defaultUser = await api.userApi.getCurrentUser()
    } catch (e) {
      error = e
    }

    if (error) {
      console.log(`Attention: an error will fail the test.`)
      console.log(`Status code: ${error.statusCode ? error.statusCode : 'Unknown'}.`)
      console.log(`If the status code is 401, most probably your trying the interact with the server using an invalid user.`)
      console.log(`If so, add the user by hand in the icure-base database (see ../templates/user.json).`)
    }

    expect(error).to.not.exist
    expect(defaultUser!!).to.exist
    expect(defaultUser!!.id).to.equal(DEFAULT_USER._id)
    expect(defaultUser!!.healthcarePartyId).to.equal(DEFAULT_HCP._id)
  })

  it('It should be possible to grab the current user HCP the local server', async () => {
    let defaultHcp: HealthcareParty | null = null
    let error: any | null = null

    try {
      defaultHcp = await api.healthcarePartyApi.getCurrentHealthcareParty()
    } catch (e) {
      error = e
    }

    expect(error).to.not.exist
    expect(defaultHcp!!).to.exist
    expect(defaultHcp!!.id).to.equal(DEFAULT_HCP._id)
    expect(defaultHcp!!.parentId).to.equal(DEFAULT_PARENT._id)
  })

  it('It should be possible to grab the current user parent HCP the local server', async () => {
    let defaultHcp: HealthcareParty | null = null
    let error: any | null = null

    try {
      defaultHcp = await api.healthcarePartyApi.getCurrentHealthcareParty()
    } catch (e) {
      error = e
    }

    expect(error).to.not.exist

    let defaultParent: HealthcareParty | null = null

    try {
      defaultParent = await api.healthcarePartyApi.getHealthcareParty(defaultHcp!!.parentId || 'fake_id', true)
    } catch (e) {
      error = e
    }

    expect(error).to.not.exist
    expect(defaultParent!!).to.exist
    expect(defaultParent!!.id).to.equal(DEFAULT_PARENT._id)
  })
})

describe('Does the HCP has its key pair well defined ?', () => {
  it('The HCP should have a public key defined', async () => {
    let defaultHcp: HealthcareParty | null = null
    let error: any | null = null

    try {
      defaultHcp = await api.healthcarePartyApi.getCurrentHealthcareParty()
    } catch (e) {
      error = e
    }

    expect(error).to.not.exist
    expect(defaultHcp!!).to.exist
    expect(defaultHcp!!.publicKey).to.exist
  })
})
