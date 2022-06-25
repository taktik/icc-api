import { expect, use } from 'chai'
import 'mocha'
import { Api } from '../../icc-x-api'
import { IccPatientApi } from '../../icc-api'
import { User } from '../../icc-api/model/User'
import { crypto } from '../../node-compat'
import { b2a, ua2hex } from '../../icc-x-api/utils/binary-utils'
import { Patient } from '../../icc-api/model/Patient'
import { TestUtils } from '../utils/test_utils'
import initKey = TestUtils.initKey

const hcpUserName = process.env.HCP_USERNAME!
const hcpPassword = process.env.HCP_PASSWORD!
const hcpPrivKey = process.env.HCP_PRIV_KEY!

const patUserName = process.env.PAT_USERNAME!
const patPassword = process.env.PAT_PASSWORD!
const patPrivKey = process.env.PAT_PRIV_KEY!

describe('Patient', () => {
  it('should be capable of creating a patient from scratch', async () => {
    const {
      patientApi: patientApiForHcp,
      userApi: userApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = Api('https://kraken.icure.dev/rest/v1', hcpUserName, hcpPassword, crypto)
    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(userApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

    try {
      const rawPatientApiForHcp = new IccPatientApi('https://kraken.icure.dev/rest/v1', {
        Authorization: `Basic ${b2a(`${hcpUserName}:${hcpPassword}`)}`,
      })
      const patient = await rawPatientApiForHcp.createPatient(new Patient({ id: cryptoApiForHcp.randomUuid(), firstName: 'Tasty', lastName: 'Test' }))
      const pwd = cryptoApiForHcp.randomUuid()
      const tmpUser = await userApiForHcp.createUser(
        new User({ id: cryptoApiForHcp.randomUuid(), login: cryptoApiForHcp.randomUuid(), passwordHash: pwd, patientId: patient.id })
      )

      try {
        const { cryptoApi } = Api('https://kraken.icure.dev/rest/v1', tmpUser.id!, pwd, crypto)
        const rawPatientApi = new IccPatientApi('https://kraken.icure.dev/rest/v1', { Authorization: `Basic ${b2a(`${tmpUser.id!}:${pwd}`)}` })
        const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
        const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
        await rawPatientApi.modifyPatient({ ...patient, publicKey: publicKeyHex })
        await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(
          patient.id!,
          new Uint8Array((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer)
        )

        try {
          const { userApi, patientApi, cryptoApi: updatedCryptoApi } = Api('https://kraken.icure.dev/rest/v1', tmpUser.id!, pwd!, crypto)
          const user = await userApi.getCurrentUser()
          let me = await patientApi.getPatientWithUser(user, user.patientId!)
          await updatedCryptoApi.getOrCreateHcPartyKey(me, user.patientId!)
          me = await patientApi.getPatientWithUser(user, user.patientId!)
          await updatedCryptoApi.getOrCreateHcPartyKey(me, '171f186a-7a2a-40f0-b842-b486428c771b')

          me = await patientApi.getPatientWithUser(user, user.patientId!)
          me = await patientApi.modifyPatientWithUser(user, await patientApi.initDelegations(me, user))

          const sek = await updatedCryptoApi.extractKeysFromDelegationsForHcpHierarchy(me.id, me.id, me.encryptionKeys)
          const sdk = await updatedCryptoApi.extractKeysFromDelegationsForHcpHierarchy(me.id, me.id, me.delegations)

          me = await patientApi.modifyPatientWithUser(
            user,
            await updatedCryptoApi.addDelegationsAndEncryptionKeys(
              null,
              me,
              user.patientId!,
              '171f186a-7a2a-40f0-b842-b486428c771b',
              sdk.extractedKeys[0],
              sek.extractedKeys[0]
            )
          )
          await patientApi.modifyPatientWithUser(user, new Patient({ ...me, note: 'This is secret' }))

          const pat2 = await patientApiForHcp.getPatientWithUser(hcpUser, patient.id!)
          expect(pat2 != null)
          expect(pat2.note != null)
        } catch (e) {
          console.log('Error in phase 3')
          throw e
        }
      } catch (e) {
        console.log('Error in phase 2')
        throw e
      }
    } catch (e) {
      console.log('Error in phase 1')
      throw e
    }
  }).timeout(60000)

  it('should be capable of logging in and encryption', async () => {
    const {
      calendarItemApi: calendarItemApiForHcp,
      patientApi: patientApiForHcp,
      userApi: userApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = Api('https://kraken.icure.dev/rest/v1', hcpUserName, hcpPassword, crypto)
    const hcpUser = await userApiForHcp.getCurrentUser()

    const patientLogin = patUserName
    const token = patPassword
    const { cryptoApi, userApi } = Api('https://kraken.icure.dev/rest/v1', patientLogin, token, crypto)
    const rawPatientApi = new IccPatientApi('https://kraken.icure.dev/rest/v1', { Authorization: `Basic ${b2a(`${patientLogin}:${token}`)}` })

    const user = await userApi.getCurrentUser()
    const patient = await rawPatientApi.getPatient(user.patientId!)
    await initKey(userApi, cryptoApi, user, patPrivKey)

    if (!patient.publicKey) {
      const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
      const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
      await rawPatientApi.modifyPatient({ ...patient, publicKey: publicKeyHex })
      await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(
        patient.id!,
        new Uint8Array((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer)
      )
    }
    const { calendarItemApi, patientApi, cryptoApi: updatedCryptoApi } = Api('https://kraken.icure.dev/rest/v1', patientLogin, token!, crypto)

    await patientApi.modifyPatientWithUser(
      user,
      await updatedCryptoApi.addDelegationsAndEncryptionKeys(
        null,
        { ...(await patientApi.getPatientWithUser(user, user.patientId!)), note: 'Secret note' },
        user.patientId!,
        hcpUser.healthcarePartyId!,
        null,
        null
      )
    )
    const ci = await calendarItemApi.createCalendarItemWithHcParty(
      user,
      await calendarItemApi.newInstancePatient(
        user,
        patient,
        { patientId: patient.id, title: 'Secret title', details: 'Important and private information' },
        [hcpUser.healthcarePartyId!]
      )
    )

    await initKey(userApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey)

    const pat2 = await patientApiForHcp.getPatientWithUser(hcpUser, patient.id!)
    const ci2 = await calendarItemApiForHcp.getCalendarItemWithUser(hcpUser, ci.id)

    expect(pat2 != null)
    expect(ci != null)
    expect(ci2 != null)
  }).timeout(60000)
})
