import { iccClassificationApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"

import * as models from "../icc-api/model/models"

import * as _ from "lodash"
import { XHR } from "../icc-api/api/XHR"
import { utils } from "./crypto/utils"
import { AES } from "./crypto/AES"

export class IccClassificationXApi extends iccClassificationApi {
  crypto: IccCryptoXApi

  constructor(host: string, headers: Array<XHR.Header>, crypto: IccCryptoXApi) {
    super(host, headers)
    this.crypto = crypto
  }

  findBy(hcpartyId: string, patient: models.PatientDto) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then((secretForeignKeys: Array<string>) =>
        this.findByHCPartyPatientSecretFKeys(hcpartyId, secretForeignKeys.join(","))
      )
    /* TODO: Decrypt if needed. The code below is copied from the health elements for reference.
      .then((helements: Array<models.HealthElementDto>) => this.decrypt(hcpartyId, helements))
      .then((decryptedHelements: Array<models.HealthElementDto>) => {
        const byIds: { [key: string]: models.HealthElementDto } = {}

        if (keepObsoleteVersions) {
          return decryptedHelements
        } else {
          decryptedHelements.forEach(he => {
            if (he.healthElementId) {
              const phe = byIds[he.healthElementId]
              if (!phe || !phe.modified || (he.modified && phe.modified < he.modified)) {
                byIds[he.healthElementId] = he
              }
            }
          })
          return _.values(byIds).filter((s: any) => !s.endOfLife)
        }
      })
      */
  }

  /** TODO: Implement decryption (if needed). The code below is copied from the health elements for reference.
  decrypt(
    hcpartyId: string,
    hes: Array<models.HealthElementDto>
  ): Promise<Array<models.HealthElementDto>> {
    return Promise.all(
      hes.map(he =>
        this.crypto
          .decryptAndImportAesHcPartyKeysInDelegations(hcpartyId, he.delegations!)
          .then(
            (
              decryptedAndImportedAesHcPartyKeys: Array<{
                delegatorId: string
                key: CryptoKey
              }>
            ) => {
              var collatedAesKeys: { [key: string]: CryptoKey } = {}
              decryptedAndImportedAesHcPartyKeys.forEach(
                k => (collatedAesKeys[k.delegatorId] = k.key)
              )
              return this.crypto
                .decryptDelegationsSFKs(he.delegations![hcpartyId], collatedAesKeys, he.id!)
                .then((sfks: Array<string>) => {
                  if (!sfks || !sfks.length) {
                    console.log("Cannot decrypt helement", he.id)
                    return Promise.resolve(he)
                  }
                  if (he.encryptedSelf) {
                    return AES.importKey("raw", utils.hex2ua(sfks[0].replace(/-/g, ""))).then(
                      key =>
                        new Promise((resolve: (value: any) => any) =>
                          AES.decrypt(key, utils.text2ua(atob(he.encryptedSelf!))).then(
                            dec => {
                              let jsonContent
                              try {
                                jsonContent = dec && utils.ua2utf8(dec)
                                jsonContent && _.assign(he, JSON.parse(jsonContent))
                              } catch (e) {
                                console.log(
                                  "Cannot parse he",
                                  he.id,
                                  jsonContent || "<- Invalid encoding"
                                )
                              }
                              resolve(he)
                            },
                            () => {
                              console.log("Cannot decrypt contact", he.id)
                              resolve(he)
                            }
                          )
                        )
                    )
                  } else {
                    return Promise.resolve(he)
                  }
                })
            }
          )
      )
    )
  }
  */
}
