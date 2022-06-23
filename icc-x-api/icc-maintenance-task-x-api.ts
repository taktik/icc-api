import {IccMaintenanceTaskApi} from "../icc-api/api/IccMaintenanceTaskApi"
import {IccCryptoXApi} from "./icc-crypto-x-api"
import {IccUserXApi} from "./icc-user-x-api"
import * as models from "../icc-api/model/models"
import * as _ from "lodash"
import {a2b, b2a, string2ua} from "../icc-api/model/ModelHelper"
import {hex2ua, ua2utf8, utf8_2ua} from "./utils"
import {utils} from "./crypto/utils"
import {IccHcpartyXApi} from "./icc-hcparty-x-api"

export class IccMaintenanceTaskXApi extends IccMaintenanceTaskApi {
  crypto: IccCryptoXApi
  userApi: IccUserXApi
  hcPartyApi: IccHcpartyXApi

  private readonly encryptedKeys: Array<string>

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    userApi: IccUserXApi,
    hcPartyApi: IccHcpartyXApi,
    encryptedKeys: Array<string> = [],
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
        ? self.fetch
        : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.userApi = userApi
    this.hcPartyApi = hcPartyApi
    this.encryptedKeys = encryptedKeys
  }

  newInstance(user: models.User,
              m: any,
              taskDelegatedTo: string | undefined = undefined,
              delegates: string[] = []) {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    const maintenanceTask = _.assign(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.MaintenanceTask',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: dataOwnerId,
        author: user.id
      },
      m || {}
    )

    return this.initDelegations(user, maintenanceTask, delegates)
  }

  initDelegations(
    user: models.User,
    maintenanceTask: models.MaintenanceTask,
    delegates: string[] = []
  ): Promise<models.MaintenanceTask> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto.initObjectDelegations(maintenanceTask, null, dataOwnerId!, null).then((initData) => {
      _.extend(maintenanceTask, { delegations: initData.delegations })

      let promise = Promise.resolve(maintenanceTask)
      _.uniq(
        delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []) : [])
      ).forEach(
        (delegateId) =>
          (promise = promise
            .then((patient) => this.crypto.extendedDelegationsAndCryptedForeignKeys(patient, null, dataOwnerId!, delegateId, initData.secretId))
            .then((extraData) => _.extend(maintenanceTask, { delegations: extraData.delegations }))
            .catch((e) => {
              console.log(e)
              return maintenanceTask
            }))
      )
      return promise
    })
  }

  initEncryptionKeys(user: models.User, maintenanceTask: models.MaintenanceTask): Promise<models.MaintenanceTask> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto.initEncryptionKeys(maintenanceTask, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
          _.extend(maintenanceTask, {
            encryptionKeys: eks.encryptionKeys,
          })
        )
      ;(user.autoDelegations ? (user.autoDelegations.all || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((patient) =>
            this.crypto
              .appendEncryptionKeys(patient, dataOwnerId!, delegateId, eks.secretId)
              .then((extraEks) => {
                return _.extend(patient, {
                  encryptionKeys: extraEks.encryptionKeys,
                })
              })
              .catch((e) => {
                console.log(e.message)
                return patient
              })
          ))
      )
      return promise
    })
  }

  createMaintenanceTask(body?: models.MaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  createMaintenanceTaskWithUser(user: models.User, body?: models.MaintenanceTask): Promise<models.MaintenanceTask | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
        .then((tasks) => super.createMaintenanceTask(tasks[0]))
        .then((mt) => this.decrypt(user, [mt]))
        .then((tasks) => tasks[0])
      : Promise.resolve(null)
  }

  filterMaintenanceTasksBy(startDocumentId?: string, limit?: number, body?: models.FilterChainMaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  filterMaintenanceTasksByWithUser(user: models.User, startDocumentId?: string, limit?: number, body?: models.FilterChainMaintenanceTask): Promise<models.PaginatedListMaintenanceTask | any> {
    return super.filterMaintenanceTasksBy(startDocumentId, limit, body)
      .then((pl) => this.decrypt(user, pl.rows!).then((dr) => Object.assign(pl, { rows: dr })))
  }

  getMaintenanceTask(maintenanceTaskId: string): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  getMaintenanceTaskWithUser(user: models.User, maintenanceTaskId: string): Promise<models.MaintenanceTask | any> {
    return super.getMaintenanceTask(maintenanceTaskId)
      .then((mt) => this.decrypt(user, [mt]))
      .then((mts) => mts[0])
  }

  modifyMaintenanceTask(body?: models.MaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  modifyMaintenanceTaskWithUser(user: models.User, body?: models.MaintenanceTask): Promise<models.MaintenanceTask | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
        .then((encTasks) => super.modifyMaintenanceTask(encTasks[0]))
        .then((mt) => this.decrypt(user, [mt]))
        .then((mts) => mts[0])
      : Promise.resolve(null)
  }


  encrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    return Promise.all(
      maintenanceTasks.map((m) =>
        (m.encryptionKeys && Object.keys(m.encryptionKeys).some((k) => !!m.encryptionKeys![k].length)
            ? Promise.resolve(m)
            : this.initEncryptionKeys(user, m)
        )
          .then((m: models.MaintenanceTask) => this.crypto.extractKeysFromDelegationsForHcpHierarchy(dataOwnerId!, m.id!, m.encryptionKeys!))
          .then((sfks: { extractedKeys: Array<string>; hcpartyId: string }) =>
            this.crypto.AES.importKey('raw', hex2ua(sfks.extractedKeys[0].replace(/-/g, '')))
          )
          .then((key: CryptoKey) =>
            utils.crypt(
              m,
              (obj: { [key: string]: string }) =>
                this.crypto.AES.encrypt(
                  key,
                  utf8_2ua(
                    JSON.stringify(obj, (k, v) => {
                      return v instanceof ArrayBuffer || v instanceof Uint8Array
                        ? b2a(new Uint8Array(v).reduce((d, b) => d + String.fromCharCode(b), ''))
                        : v
                    })
                  )
                ),
              this.encryptedKeys
            )
          )
      )
    )
  }

  decrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    return Promise.all(
      maintenanceTasks.map((mT) =>
        this.crypto
          .extractKeysFromDelegationsForHcpHierarchy(dataOwnerId, mT.id!, mT.encryptionKeys ?? {})
          .then(({ extractedKeys: sfks }) => {
            if (!sfks || !sfks.length) {
              console.log('Cannot decrypt maintenanceTask', mT.id)
              return Promise.resolve(mT)
            }
            if (mT.encryptedSelf) {
              return this.crypto.AES.importKey('raw', hex2ua(sfks[0].replace(/-/g, ''))).then(
                (key) =>
                  new Promise((resolve: (value: any) => any) =>
                    this.crypto.AES.decrypt(key, string2ua(a2b(mT.encryptedSelf!))).then(
                      (dec) => {
                        let jsonContent
                        try {
                          jsonContent = dec && ua2utf8(dec)
                          jsonContent && _.assign(mT, JSON.parse(jsonContent))
                        } catch (e) {
                          console.log('Cannot parse mTask', mT.id, jsonContent || '<- Invalid encoding')
                        }
                        resolve(mT)
                      },
                      () => {
                        console.log('Cannot decrypt mTask', mT.id)
                        resolve(mT)
                      }
                    )
                  )
              )
            } else {
              return Promise.resolve(mT)
            }
          })
      )
    )
  }
}
