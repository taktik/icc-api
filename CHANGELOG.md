# icc-api CHANGELOG

## 4.2.29

- [BREAKING] - Make Api() async so that we can call authAPi.login and clear session cookie

## 4.2.20

- [FEATURE] - Add a tag to groups to differentiate root, apps and databases

### Breaking changes for 4.2.20

The createGroup signature has been slightly altered with an extra argument before the databaseSynchronisations argument

## 4.2.19

- Internal release

## 4.2.18

- [FIX] - Do not send BASIC auth if cookies are available

## 4.2.17

- Internal release

## 4.2.16

- [FIX] - Do not send BASIC auth while logging out in order to prevent creation of a new session

## 4.2.15

- [FIX] - Add missing X-Requested-With: XMLHttpRequest header in XHR.ts

## 4.2.13

- [FIX] - Invalidate caches when hcparty keys cannot be found

## 4.2.12

- [FIX] - Fix path in AMP by ATC

## 4.2.11

- [FEATURE] - Added delete group endpoint

## 4.2.10

- [FEATURE] [#90](https://github.com/taktik/icc-api/pull/90) - Adding ServiceByHcPartyAndHealthElementIdsFilter

## 4.2.9

- [FEATURE] [487e0abae86e0d2d978774c8bcc2d108a322bf49](https://github.com/taktik/icc-api/commit/487e0abae86e0d2d978774c8bcc2d108a322bf49) - Add support for devices per group endpoints

## 4.2.8

- [FEATURE] [1309bd53ae06a0c8d2e8ebaa9986669d0e37bb2a](https://github.com/taktik/icc-api/commit/1309bd53ae06a0c8d2e8ebaa9986669d0e37bb2a) - Switched doImport from GET to POST

## 4.2.7

- [FEATURE] [b1de8da2ba3c08e49bf311a9c565aa29061859cb](https://github.com/taktik/icc-api/commit/b1de8da2ba3c08e49bf311a9c565aa29061859cb) - Upgrade UserGroup

## 4.2.6

- [FEATURE] [deb9ea154fbcbeb2f2ba386a13379cced8b88fe3](https://github.com/taktik/icc-api/commit/deb9ea154fbcbeb2f2ba386a13379cced8b88fe3) - Add incapacity api

## 4.2.5

- [FEATURE] [874e1f83e0b2f67e2541653fa086ae4286564a48](https://github.com/taktik/icc-api/commit/874e1f83e0b2f67e2541653fa086ae4286564a48) - Add icapacity dtos + extra token request api

## 4.2.4

- [FEATURE] [b2dfb46089bb95029b32fcef1c7c49029408b1b2](https://github.com/taktik/icc-api/commit/b2dfb46089bb95029b32fcef1c7c49029408b1b2) - Add api to search users in groups

## 4.2.3

- [FEATURE] [6a658d4fddf99b61ee74a892eec8d15701b62daf](https://github.com/taktik/icc-api/commit/6a658d4fddf99b61ee74a892eec8d15701b62daf) - Add PermissionApi in API services

## 4.2.2

- [FIX] [#88](https://github.com/taktik/icc-api/pull/88) - UserByNameEmailPhoneFilter Typo

## 4.2.1

- [FIX] [#87](https://github.com/taktik/icc-api/pull/87) - Add descr property on hcp

## 4.2.0

- [FEATURE] [#86](https://github.com/taktik/icc-api/pull/86) - BREAK Add icc-helement-x-api services managing encryption/decryption
- [FEATURE] [#86](https://github.com/taktik/icc-api/pull/86) - Every dataOwner is now supported for encryption/decryption services (not only HCP anymore)
- [FEATURE] [a3318e7477b929a00bc8227080fa424cd2896d6b](https://github.com/taktik/icc-api/commit/a3318e7477b929a00bc8227080fa424cd2896d6b) - Add getGroupsStorageInfos API in IccGroupApi
- [FEATURE] [a3318e7477b929a00bc8227080fa424cd2896d6b](https://github.com/taktik/icc-api/commit/a3318e7477b929a00bc8227080fa424cd2896d6b) - Add getUserSyncInfo API in IccIcureApi
- [FEATURE] [531eaf99c2d1a91cb3e228bda2cfc71c5a99b8f4](https://github.com/taktik/icc-api/commit/531eaf99c2d1a91cb3e228bda2cfc71c5a99b8f4) - Add findGroupsWithContent API in IccGroupApi
- [FEATURE] [f53614ef84b8cb525820d1e1a3fbed1b98e62c2e](https://github.com/taktik/icc-api/commit/f53614ef84b8cb525820d1e1a3fbed1b98e62c2e) - Add UserByNameEmailPhoneFilter

### Breaking changes for [#86](https://github.com/taktik/icc-api/pull/86)

icc-helement-x-api now includes API services managing encryption/decryption. Just like other APIs, icc-helement-api services not managing encryption
throw an Error in order to force the usage of the corresponding new APIs.

In the next table, you will find all deleted services and their corresponding substitute

| Previous service                                                                        | New service                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `createHealthElement(body?: HealthElement)`                                             | `createHealthElementWithUser(user: User, body?: HealthElement)`                                                    |
| `createHealthElements(body?: Array<HealthElement>)`                                     | `createHealthElementsWithUser(user: models.User, bodies?: models.HealthElement[])`                                 |
| `getHealthElement(healthElementId: string)`                                             | `getHealthElementWithUser(user: models.User, healthElementId: string)`                                             |
| `getHealthElements(body?: models.ListOfIds)`                                            | `getHealthElementsWithUser(user: models.User, body?: models.ListOfIds)`                                            |
| `newHealthElementDelegations(healthElementId: string, body?: Array<models.Delegation>)` | `newHealthElementDelegationsWithUser(user: models.User, healthElementId: string, body?: Array<models.Delegation>)` |
| `findHealthElementsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string)` | `findHealthElementsByHCPartyPatientForeignKeysWithUser(user: models.User, hcPartyId: string, secretFKeys: string)` |
| `modifyHealthElement(body?: HealthElement)`                                             | `modifyHealthElementWithUser(user: models.User, body?: HealthElement)`                                             |
| `modifyHealthElements(body?: Array<HealthElement>)`                                     | `modifyHealthElementsWithUser(user: models.User, bodies?: HealthElement[])`                                        |
