import { iccInvoiceApi, iccEntityrefApi } from "../icc-api/iccApi"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import * as models from "../icc-api/model/models"
import { InvoiceDto } from "../icc-api/model/models"
export declare class IccInvoiceXApi extends iccInvoiceApi {
  crypto: IccCryptoXApi
  entityrefApi: iccEntityrefApi
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    entityrefApi: iccEntityrefApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(
    user: models.UserDto,
    patient: models.PatientDto,
    inv?: any
  ): Promise<models.InvoiceDto>
  private initDelegationsAndEncryptionKeys
  initEncryptionKeys(
    user: models.UserDto,
    invoice: models.InvoiceDto
  ): Promise<
    models.InvoiceDto & {
      encryptionKeys: any
    }
  >
  createInvoice(invoice: InvoiceDto, prefix?: string): Promise<InvoiceDto>
  getNextInvoiceReference(prefix: string, entityrefApi: iccEntityrefApi): Promise<number>
  createInvoiceReference(
    nextReference: number,
    docId: string,
    prefix: string,
    entityrefApi: iccEntityrefApi
  ): Promise<models.EntityReference>
  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all invoices with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the invoices of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   */
  findBy(hcpartyId: string, patient: models.PatientDto): Promise<Array<models.InvoiceDto>>
  encrypt(user: models.UserDto, invoices: Array<models.InvoiceDto>): Promise<models.InvoiceDto[]>
  decrypt(hcpartyId: string, invoices: Array<models.InvoiceDto>): Promise<Array<models.InvoiceDto>>
}
