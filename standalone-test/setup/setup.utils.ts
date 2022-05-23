import { assert } from 'chai'
import fetch from 'node-fetch'

const DEFAULT_USER = require('./content/user.json')
const DEFAULT_HCP = require('./content/hcp.json')
const DEFAULT_PARENT = require('./content/parent.json')

const COUCHDB_URL = 'http://localhost:5984'
const DB_AUTHENTICATION_HEADER = `Basic ${Buffer.from('couch_user:password').toString('base64')}`

describe('Standalone setup should be ready', () => {
  it('Standalone USER should be found on the local CouchDB instance', async () => {
    const defaultUser = await fetch(`${COUCHDB_URL}/icure-base/${DEFAULT_USER._id}`, {
      method: 'get',
      headers: { Authorization: DB_AUTHENTICATION_HEADER },
    }).then((res) => res.json())

    assert(defaultUser != null)
    assert(
      defaultUser.error != 'unauthorized',
      'It seems that valid DB connnection credentials were provided. This happens when no such credentials have been given to connect to the local CouchDB instance on http://localhost:5984. Please, check the "DB_AUTHENTICATION_HEADER" above.'
    )

    if (defaultUser.error === 'not_found') {
      console.log("Default user is missing. Let's add it...")

      const addDefaultUser = await fetch(`${COUCHDB_URL}/icure-base/${DEFAULT_USER._id}`, {
        method: 'put',
        headers: { Authorization: DB_AUTHENTICATION_HEADER },
        body: JSON.stringify(DEFAULT_USER),
      }).then((res) => res.json())

      assert(addDefaultUser != null)
      assert(addDefaultUser.error == null)
      assert(addDefaultUser.ok)
      console.log('Default user added !')
    } else {
      assert(defaultUser.error == null)
      assert(defaultUser._id === DEFAULT_USER._id)
    }
  })

  it('Standalone HCP should be found on the local CouchDB instance', async () => {
    const defaultHcp = await fetch(`${COUCHDB_URL}/icure-base/${DEFAULT_HCP._id}`, {
      method: 'get',
      headers: { Authorization: DB_AUTHENTICATION_HEADER },
    }).then((res) => res.json())

    assert(defaultHcp != null)
    assert(
      defaultHcp.error != 'unauthorized',
      'It seems that valid DB connnection credentials were provided. This happens when no such credentials have been given to connect to the local CouchDB instance on http://localhost:5984. Please, check the "DB_AUTHENTICATION_HEADER" above.'
    )

    if (defaultHcp.error === 'not_found') {
      console.log("Default hcp is missing. Let's add it...")

      const addDefaultHcp = await fetch(`${COUCHDB_URL}/icure-base/${DEFAULT_HCP._id}`, {
        method: 'put',
        headers: { Authorization: DB_AUTHENTICATION_HEADER },
        body: JSON.stringify(DEFAULT_HCP),
      }).then((res) => res.json())

      assert(addDefaultHcp != null)
      assert(addDefaultHcp.error == null)
      assert(addDefaultHcp.ok)
      console.log('Default hcp added !')
    } else {
      assert(defaultHcp.error == null)
      assert(defaultHcp._id === DEFAULT_HCP._id)
    }
  })
  it('Standalone PARENT_HCP should be found on the local CouchDB instance', async () => {
    const defaultParentHcp = await fetch(`${COUCHDB_URL}/icure-base/${DEFAULT_PARENT._id}`, {
      method: 'get',
      headers: { Authorization: DB_AUTHENTICATION_HEADER },
    }).then((res) => res.json())

    assert(defaultParentHcp != null)
    assert(
      defaultParentHcp.error != 'unauthorized',
      'It seems that valid DB connnection credentials were provided. This happens when no such credentials have been given to connect to the local CouchDB instance on http://localhost:5984. Please, check the "DB_AUTHENTICATION_HEADER" above.'
    )

    if (defaultParentHcp.error === 'not_found') {
      console.log("Default parent hcp is missing. Let's add it...")

      const addDefaultParentHcp = await fetch(`${COUCHDB_URL}/icure-base/${DEFAULT_PARENT._id}`, {
        method: 'put',
        headers: { Authorization: DB_AUTHENTICATION_HEADER },
        body: JSON.stringify(DEFAULT_PARENT),
      }).then((res) => res.json())

      assert(addDefaultParentHcp != null)
      assert(addDefaultParentHcp.error == null)
      assert(addDefaultParentHcp.ok)
      console.log('Default parent hcp added !')
    } else {
      assert(defaultParentHcp.error == null)
      assert(defaultParentHcp._id === DEFAULT_PARENT._id)
    }
  })
})
