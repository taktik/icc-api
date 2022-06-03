import { assert } from 'chai'
import 'isomorphic-fetch'
import { COUCHDB_PASSWORD, COUCHDB_URL, COUCHDB_USERNAME, HCP, PARENT, USER } from '../standalone-test.env'

const DB_AUTHENTICATION_HEADER = `Basic ${Buffer.from(`${COUCHDB_USERNAME}:${COUCHDB_PASSWORD}`).toString('base64')}`

describe('Standalone setup should be ready', () => {
  it('Standalone USER should be found on the local CouchDB instance', async () => {
    const defaultUser = await fetch(`${COUCHDB_URL}/icure-base/${USER._id}`, {
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

      const addDefaultUser = await fetch(`${COUCHDB_URL}/icure-base/${USER._id}`, {
        method: 'put',
        headers: { Authorization: DB_AUTHENTICATION_HEADER },
        body: JSON.stringify(USER),
      }).then((res) => res.json())

      assert(addDefaultUser != null)
      assert(addDefaultUser.error == null)
      assert(addDefaultUser.ok)
      console.log('Default user added !')
    } else {
      assert(defaultUser.error == null)
      assert(defaultUser._id === USER._id)
    }
  })

  it('Standalone HCP should be found on the local CouchDB instance', async () => {
    const defaultHcp = await fetch(`${COUCHDB_URL}/icure-base/${HCP._id}`, {
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

      const addDefaultHcp = await fetch(`${COUCHDB_URL}/icure-base/${USER._id}`, {
        method: 'put',
        headers: { Authorization: DB_AUTHENTICATION_HEADER },
        body: JSON.stringify(USER),
      }).then((res) => res.json())

      assert(addDefaultHcp != null)
      assert(addDefaultHcp.error == null)
      assert(addDefaultHcp.ok)
      console.log('Default hcp added !')
    } else {
      assert(defaultHcp.error == null)
      assert(defaultHcp._id === HCP._id)
    }
  })

  it('Standalone PARENT_HCP should be found on the local CouchDB instance', async () => {
    const defaultParentHcp = await fetch(`${COUCHDB_URL}/icure-base/${PARENT._id}`, {
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

      const addDefaultParentHcp = await fetch(`${COUCHDB_URL}/icure-base/${PARENT._id}`, {
        method: 'put',
        headers: { Authorization: DB_AUTHENTICATION_HEADER },
        body: JSON.stringify(PARENT),
      }).then((res) => res.json())

      assert(addDefaultParentHcp != null)
      assert(addDefaultParentHcp.error == null)
      assert(addDefaultParentHcp.ok)
      console.log('Default parent hcp added !')
    } else {
      assert(defaultParentHcp.error == null)
      assert(defaultParentHcp._id === PARENT._id)
    }
  })
})
