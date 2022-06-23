import { before } from 'mocha'

import 'isomorphic-fetch'

import { LocalStorage } from 'node-localstorage'
import * as os from 'os'
import {Api, IccHelementXApi} from '../../icc-x-api'
import { crypto } from '../../node-compat'
import { Patient } from '../../icc-api/model/Patient'
import { assert } from 'chai'
import { randomUUID } from 'crypto'
import { TestUtils } from '../utils/test_utils'
import initKey = TestUtils.initKey
import {User} from "../../icc-api/model/User"
import {HealthElement} from "../../icc-api/model/HealthElement"
import {Code} from "../../icc-api/model/Code"
import {IccMaintenanceTaskXApi} from "../../icc-x-api/icc-maintenance-task-x-api"
import {MaintenanceTask} from "../../icc-api/model/MaintenanceTask"
import {PropertyStub} from "../../icc-api/model/PropertyStub"
import {PropertyTypeStub} from "../../icc-api/model/PropertyTypeStub"
import {TypedValueObject} from "../../icc-api/model/TypedValueObject"
import {HealthcareParty} from "../../icc-api/model/HealthcareParty"
import {Identifier} from "../../icc-api/model/Identifier"
import {FilterChainMaintenanceTask} from "../../icc-api/model/FilterChainMaintenanceTask"
import {MaintenanceTaskByIdsFilter} from "../../icc-x-api/filters/MaintenanceTaskByIdsFilter"
import {FilterChainService} from "../../icc-api/model/FilterChainService"
import {ServiceByHcPartyHealthElementIdsFilter} from "../../icc-x-api/filters/ServiceByHcPartyHealthElementIdsFilter"
import {MaintenanceTaskByHcPartyAndTypeFilter} from "../../icc-x-api/filters/MaintenanceTaskByHcPartyAndTypeFilter"
const tmp = os.tmpdir()
console.log('Saving keys in ' + tmp)
;(global as any).localStorage = new LocalStorage(tmp, 5 * 1024 * 1024 * 1024)
;(global as any).Storage = ''

const iCureUrl = process.env.ICURE_URL ?? 'https://kraken.icure.dev/rest/v1'
const hcp1UserName = process.env.HCP_USERNAME!
const hcp1Password = process.env.HCP_PASSWORD!
const hcp1PrivKey = process.env.HCP_PRIV_KEY!

const hcp2UserName = process.env.HCP_2_USERNAME!
const hcp2Password = process.env.HCP_2_PASSWORD!
const hcp2PrivKey = process.env.HCP_2_PRIV_KEY!

function maintenanceTaskToCreate(mTaskApiForHcp: IccMaintenanceTaskXApi, hcpUser: User, delegatedTo: HealthcareParty) {
  return mTaskApiForHcp.newInstance(
    hcpUser,
    new MaintenanceTask({
      id: randomUUID(),
      taskType: randomUUID(),
      status: MaintenanceTask.StatusEnum.Pending,
      properties: [
        new PropertyStub({
          id: "dataOwnerConcernedId",
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: delegatedTo.id
          })
        }),
        new PropertyStub({
          id: "dataOwnerConcernedPubKey",
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: delegatedTo.publicKey
          })
        })
      ]
    }),
    delegatedTo.id
  )
}

before(() => {
  console.info(`Starting tests using iCure URL : ${iCureUrl}`)

  if (hcp1UserName == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_USERNAME`)
  }

  if (hcp1Password == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_PASSWORD`)
  }

  if (hcp1PrivKey == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_PRIV_KEY`)
  }

  if (hcp2UserName == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_2_USERNAME`)
  }

  if (hcp2Password == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_2_PASSWORD`)
  }

  if (hcp2PrivKey == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_2_PRIV_KEY`)
  }
})

describe('icc-x-maintenance-task-api Tests', () => {
  it('CreateMaintenanceTaskWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp1,
      maintenanceTaskApi: maintenanceTaskApiForHcp1,
      cryptoApi: cryptoApiForHcp1,
    } = Api(iCureUrl, hcp1UserName!, hcp1Password!, crypto)

    const hcp1User = await userApiForHcp1.getCurrentUser()
    await initKey(userApiForHcp1, cryptoApiForHcp1, hcp1User, hcp1PrivKey!)

    const {
      userApi: userApiForHcp2,
      healthcarePartyApi: hcPartyApiForHcp2,
      maintenanceTaskApi: maintenanceTaskApiForHcp2,
    } = Api(iCureUrl, hcp1UserName!, hcp1Password!, crypto)

    const hcp2User = await userApiForHcp2.getCurrentUser()
    const hcp2 = await hcPartyApiForHcp2.getCurrentHealthcareParty()

    let taskToCreate = await maintenanceTaskToCreate(maintenanceTaskApiForHcp1, hcp1User, hcp2)

    // When
    let createdTask = await maintenanceTaskApiForHcp1.createMaintenanceTaskWithUser(hcp1User, taskToCreate)

    // Then
    assert(createdTask != null)
    assert(createdTask.id == taskToCreate.id)
    assert(createdTask.delegations[hcp1User.healthcarePartyId!] != undefined)
    assert(createdTask.delegations[hcp2User.healthcarePartyId!] != undefined)
    assert(createdTask.encryptionKeys[hcp1User.healthcarePartyId!] != undefined)
    assert(createdTask.encryptionKeys[hcp2User.healthcarePartyId!] != undefined)

    let foundTask: MaintenanceTask = await maintenanceTaskApiForHcp2.getMaintenanceTaskWithUser(hcp2User, createdTask.id)

    assert(foundTask.id == createdTask.id)
    assert(foundTask.properties?.find((prop: PropertyStub) => prop.typedValue?.stringValue == hcp2.id) != undefined)
    assert(foundTask.properties?.find((prop: PropertyStub) => prop.typedValue?.stringValue == hcp2.publicKey) != undefined)
  }).timeout(10000);

  it('ModifyMaintenanceTaskWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp1,
      healthcarePartyApi: hcPartyApiForHcp1,
      maintenanceTaskApi: maintenanceTaskApiForHcp1,
      cryptoApi: cryptoApiForHcp1,
    } = Api(iCureUrl, hcp1UserName!, hcp1Password!, crypto)

    const hcp1User = await userApiForHcp1.getCurrentUser()
    const hcp1 = await hcPartyApiForHcp1.getCurrentHealthcareParty()
    await initKey(userApiForHcp1, cryptoApiForHcp1, hcp1User, hcp1PrivKey!)

    let createdTask: MaintenanceTask = await maintenanceTaskApiForHcp1.createMaintenanceTaskWithUser(hcp1User, await maintenanceTaskToCreate(maintenanceTaskApiForHcp1, hcp1User, hcp1))
    let identifierToAdd = new Identifier({id: "SYSTEM-TEST|VALUE-TEST", system: "SYSTEM-TEST", value: "VALUE-TEST"})

    // When
    let updatedTask: MaintenanceTask = await maintenanceTaskApiForHcp1.modifyMaintenanceTaskWithUser(hcp1User, new MaintenanceTask({...createdTask, identifier: [identifierToAdd], status: MaintenanceTask.StatusEnum.Ongoing }))

    // Then
    assert(updatedTask.id == createdTask.id)
    assert(updatedTask.identifier?.[0].system == identifierToAdd.system)
    assert(updatedTask.identifier?.[0].value == identifierToAdd.value)
    assert(updatedTask.identifier?.[0].id == identifierToAdd.id)
    assert(updatedTask.status == MaintenanceTask.StatusEnum.Ongoing)
  }).timeout(10000);

  it('FilterMaintenanceTaskByWithUser By Ids Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp1,
      healthcarePartyApi: hcPartyApiForHcp1,
      maintenanceTaskApi: maintenanceTaskApiForHcp1,
      cryptoApi: cryptoApiForHcp1,
    } = Api(iCureUrl, hcp1UserName!, hcp1Password!, crypto)

    const hcp1User = await userApiForHcp1.getCurrentUser()
    const hcp1 = await hcPartyApiForHcp1.getCurrentHealthcareParty()
    await initKey(userApiForHcp1, cryptoApiForHcp1, hcp1User, hcp1PrivKey!)

    let createdTask: MaintenanceTask = await maintenanceTaskApiForHcp1.createMaintenanceTaskWithUser(hcp1User, await maintenanceTaskToCreate(maintenanceTaskApiForHcp1, hcp1User, hcp1))

    // When
    let foundTask = (await maintenanceTaskApiForHcp1.filterMaintenanceTasksByWithUser(hcp1User, undefined, undefined,
      new FilterChainMaintenanceTask({
        filter: new MaintenanceTaskByIdsFilter({
          ids: [createdTask.id!]
        })
      })
    )).rows[0] as MaintenanceTask


    // Then
    assert(foundTask.id == createdTask.id)
  });

  it('FilterMaintenanceTaskByWithUser By Type Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp1,
      healthcarePartyApi: hcPartyApiForHcp1,
      maintenanceTaskApi: maintenanceTaskApiForHcp1,
      cryptoApi: cryptoApiForHcp1,
    } = Api(iCureUrl, hcp1UserName!, hcp1Password!, crypto)

    const hcp1User = await userApiForHcp1.getCurrentUser()
    const hcp1 = await hcPartyApiForHcp1.getCurrentHealthcareParty()
    await initKey(userApiForHcp1, cryptoApiForHcp1, hcp1User, hcp1PrivKey!)

    let createdTask: MaintenanceTask = await maintenanceTaskApiForHcp1.createMaintenanceTaskWithUser(hcp1User, await maintenanceTaskToCreate(maintenanceTaskApiForHcp1, hcp1User, hcp1))

    // When
    let foundTask = (await maintenanceTaskApiForHcp1.filterMaintenanceTasksByWithUser(hcp1User, undefined, undefined,
      new FilterChainMaintenanceTask({
        filter: new MaintenanceTaskByHcPartyAndTypeFilter({
          healthcarePartyId: hcp1.id!,
          type: createdTask.taskType!
        })
      })
    )).rows[0]


    // Then
    assert(foundTask.id == createdTask.id)
  });
})
