import * as models from "../icc-api/model/models"
import { IccCryptoXApi } from "./icc-crypto-x-api"
import { iccCalendarItemApi } from "../icc-api/iccApi"
import { CalendarItemDto, UserDto } from "../icc-api/model/models"
export declare class IccCalendarItemXApi extends iccCalendarItemApi {
  i18n: any
  crypto: IccCryptoXApi
  cryptedKeys: string[]
  constructor(
    host: string,
    headers: {
      [key: string]: string
    },
    crypto: IccCryptoXApi,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  newInstance(
    user: UserDto,
    ci: CalendarItemDto
  ): Promise<
    {
      id: string
      _type: string
      created: number
      modified: number
      responsible: string | undefined
      author: string | undefined
      codes: never[]
      tags: never[]
    } & models.CalendarItemDto
  >
  newInstancePatient(
    user: models.UserDto,
    patient: models.PatientDto,
    ci: any
  ): Promise<models.CalendarItemDto>
  initDelegationsAndEncryptionKeys(
    user: models.UserDto,
    patient: models.PatientDto,
    calendarItem: models.CalendarItemDto
  ): Promise<models.CalendarItemDto>
  findBy(hcpartyId: string, patient: models.PatientDto): Promise<any>
  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys?: string
  ): Promise<Array<models.CalendarItemDto> | any>
  createCalendarItem(body?: CalendarItemDto): never
  createCalendarItemWithHcParty(
    user: models.UserDto,
    body?: models.CalendarItemDto
  ): Promise<models.CalendarItemDto | any>
  getCalendarItemWithUser(
    user: models.UserDto,
    calendarItemId: string
  ): Promise<CalendarItemDto | any>
  getCalendarItem(calendarItemId: string): never
  getCalendarItemsWithUser(user: models.UserDto): Promise<Array<CalendarItemDto> | any>
  getCalendarItems(): never
  getCalendarItemsWithIdsWithUser(
    user: models.UserDto,
    body?: models.ListOfIdsDto
  ): Promise<Array<CalendarItemDto> | any>
  getCalendarItemsWithIds(body?: models.ListOfIdsDto): never
  getCalendarItemsByPeriodAndHcPartyIdWithUser(
    user: models.UserDto,
    startDate?: number,
    endDate?: number,
    hcPartyId?: string
  ): Promise<Array<CalendarItemDto> | any>
  getCalendarItemsByPeriodAndHcPartyId(
    startDate?: number,
    endDate?: number,
    hcPartyId?: string
  ): never
  getCalendarsByPeriodAndAgendaIdWithUser(
    user: models.UserDto,
    startDate?: number,
    endDate?: number,
    agendaId?: string
  ): Promise<Array<CalendarItemDto> | any>
  getCalendarsByPeriodAndAgendaId(startDate?: number, endDate?: number, agendaId?: string): never
  modifyCalendarItem(body?: CalendarItemDto): never
  /**
   * Remove the following delegation objects from the
   * CalendarItem instance: cryptedForeignKeys, secretForeignKeys.
   *
   * The delegations & encryptionKeys objects are not removed because
   * in the case the CalendarItem is saved in the DB & then encrypted,
   * if later we remove the patient from it, it'd reset the delegations
   * and encryptionKeys thus impossibilitating further access.
   *
   * @param calendarItem The Calendar Item object
   */
  resetCalendarDelegationObjects(calendarItem: models.CalendarItemDto): models.CalendarItemDto
  modifyCalendarItemWithHcParty(
    user: models.UserDto,
    body?: models.CalendarItemDto
  ): Promise<models.CalendarItemDto | any>
  initEncryptionKeys(
    user: models.UserDto,
    calendarItem: models.CalendarItemDto
  ): Promise<
    models.CalendarItemDto & {
      encryptionKeys: any
    }
  >
  encrypt(
    user: models.UserDto,
    calendarItems: Array<models.CalendarItemDto>
  ): Promise<Array<models.CalendarItemDto>>
  decrypt(
    hcpId: string,
    calendarItems: Array<models.CalendarItemDto>
  ): Promise<Array<models.CalendarItemDto>>
}
