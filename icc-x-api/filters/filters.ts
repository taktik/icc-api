import { ConstantFilter } from "./ConstantFilter"
import { Patient } from "../../icc-api/model/Patient"
import { AbstractFilterPatient } from "../../icc-api/model/AbstractFilterPatient"
import { AbstractFilterContact } from "../../icc-api/model/AbstractFilterContact"
import { AbstractFilterService } from "../../icc-api/model/AbstractFilterService"
import { Service } from "../../icc-api/model/Service"
import { Contact } from "../../icc-api/model/Contact"
import { IntersectionFilter } from "./IntersectionFilter"
import { UnionFilter } from "./UnionFilter"
import { ComplementFilter } from "./ComplementFilter"
import { PatientByHcPartyAndActiveFilter } from "./PatientByHcPartyAndActiveFilter"
import { PatientByHcPartyAndExternalIdFilter } from "./PatientByHcPartyAndExternalIdFilter"
import { PatientByHcPartyAndSsinsFilter } from "./PatientByHcPartyAndSsinsFilter"
import { PatientByHcPartyDateOfBirthBetweenFilter } from "./PatientByHcPartyDateOfBirthBetweenFilter"
import { PatientByHcPartyDateOfBirthFilter } from "./PatientByHcPartyDateOfBirthFilter"

import { format, add } from "date-fns"
import { PatientByHcPartyFilter } from "./PatientByHcPartyFilter"
import GenderEnum = Patient.GenderEnum
import { PatientByHcPartyGenderEducationProfession } from "./PatientByHcPartyGenderEducationProfession"
import { PatientByIdsFilter } from "./PatientByIdsFilter"
import { PatientByHcPartyNameContainsFuzzyFilter } from "./PatientByHcPartyNameContainsFuzzyFilter"

export * from "./PatientByHcPartyAndActiveFilter"
export * from "./PatientByHcPartyAndExternalIdFilter"
export * from "./PatientByHcPartyAndSsinsFilter"
export * from "./PatientByHcPartyDateOfBirthBetweenFilter"
export * from "./PatientByHcPartyDateOfBirthFilter"
export * from "./PatientByHcPartyFilter"
export * from "./PatientByHcPartyGenderEducationProfession"
export * from "./PatientByHcPartyNameContainsFuzzyFilter"
export * from "./PatientByHcPartyNameFilter"
export * from "./PatientByIdsFilter"

export class Filter {
  public static patient() {
    return new PatientFilterBuilder()
  }
}

interface YetToBeImplementedFilter<T> {}

export type AbstractFilter<T> = T extends Patient
  ?
      | AbstractFilterPatient
      | ConstantFilter<T>
      | IntersectionFilter<T>
      | UnionFilter<T>
      | ComplementFilter<T>
      | YetToBeImplementedFilter<T>
  : T extends Contact
  ?
      | AbstractFilterContact
      | ConstantFilter<T>
      | IntersectionFilter<T>
      | UnionFilter<T>
      | ComplementFilter<T>
      | YetToBeImplementedFilter<T>
  : T extends Service
  ? AbstractFilterService
  :
      | ConstantFilter<T>
      | IntersectionFilter<T>
      | UnionFilter<T>
      | ComplementFilter<T>
      | YetToBeImplementedFilter<T>

class FilterBuilder<T> {
  filter?: AbstractFilter<T>

  constructor(filter?: AbstractFilter<T>) {
    this.filter = filter
  }

  listOf(elements: T[]): FilterBuilder<T> {
    return new FilterBuilder<T>(new ConstantFilter<T>(elements) as AbstractFilter<T>)
  }

  and(filter: AbstractFilter<T>): FilterBuilder<T> {
    return this.filter
      ? new FilterBuilder(
          new IntersectionFilter<T>([this.filter, filter]) as AbstractFilter<T>
        )
      : new FilterBuilder(filter)
  }

  add(filter: AbstractFilter<T>): FilterBuilder<T> {
    return this.filter
      ? new FilterBuilder(
          new UnionFilter<T>([this.filter, filter]) as AbstractFilter<T>
        )
      : new FilterBuilder(filter)
  }

  minus(filter: AbstractFilter<T>): FilterBuilder<T> {
    return this.filter
      ? new FilterBuilder(new ComplementFilter<T>(this.filter, filter) as AbstractFilter<T>)
      : this
  }
}

class PatientFilterBuilder extends FilterBuilder<Patient> {
  hcpId?: string

  constructor(filter?: AbstractFilter<Patient>, hcpId?: string) {
    super(filter)
    this.hcpId = hcpId
  }

  and(filter: AbstractFilter<Patient>): PatientFilterBuilder {
    return this.filter
      ? new PatientFilterBuilder(
          new IntersectionFilter<Patient>([this.filter, filter]) as AbstractFilter<Patient>
        )
      : new PatientFilterBuilder(filter)
  }

  add(filter: AbstractFilter<Patient>): PatientFilterBuilder {
    return this.filter
      ? new PatientFilterBuilder(
          new UnionFilter<Patient>([this.filter, filter]) as AbstractFilter<Patient>
        )
      : new PatientFilterBuilder(filter)
  }

  minus(filter: AbstractFilter<Patient>): PatientFilterBuilder {
    return this.filter
      ? new PatientFilterBuilder(
          new ComplementFilter<Patient>(this.filter, filter) as AbstractFilter<Patient>
        )
      : this
  }

  forHcp(hcpId: string): PatientFilterBuilder {
    return new PatientFilterBuilder(this.filter, hcpId)
  }

  all(): PatientFilterBuilder {
    return new PatientFilterBuilder(new PatientByHcPartyFilter({ healthcarePartyId: this.hcpId }))
  }

  activePatients(): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true })
    )
  }

  inactivePatients(): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false })
    )
  }

  withExternalId(externalId: string): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyAndExternalIdFilter({
        healthcarePartyId: this.hcpId,
        externalId: externalId,
      })
    )
  }

  withSsins(ssins: string[]): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins })
    )
  }

  withDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyDateOfBirthBetweenFilter({
        healthcarePartyId: this.hcpId,
        minDateOfBirth: from,
        maxDateOfBirth: to,
      })
    )
  }

  byDateOfBirth(dateOfBirth: number): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyDateOfBirthFilter({
        healthcarePartyId: this.hcpId,
        dateOfBirth: dateOfBirth,
      })
    )
  }

  olderThan(age: number): PatientFilterBuilder {
    return this.withDateOfBirthBetween(
      undefined,
      parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd"))
    )
  }

  youngerThan(age: number): PatientFilterBuilder {
    return this.withDateOfBirthBetween(
      parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd"))
    )
  }

  byGenderEducationProfession(
    gender?: GenderEnum,
    education?: String,
    profession?: String
  ): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyGenderEducationProfession({
        healthcarePartyId: this.hcpId,
        gender: gender,
        education: education,
        profession: profession,
      })
    )
  }

  byIds(ids: string[]): PatientFilterBuilder {
    return new PatientFilterBuilder(new PatientByIdsFilter({ ids: ids }))
  }

  searchByName(name: string): PatientFilterBuilder {
    return new PatientFilterBuilder(
      new PatientByHcPartyNameContainsFuzzyFilter({
        healthcarePartyId: this.hcpId,
        searchString: name,
      })
    )
  }

  orActivePatients(): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true })
      ) as AbstractFilterPatient
    )
  }

  orInactivePatients(): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false })
      )
    )
  }

  orWithExternalId(externalId: string): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyAndExternalIdFilter({
          healthcarePartyId: this.hcpId,
          externalId: externalId,
        })
      )
    )
  }

  orWithSsins(ssins: string[]): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins })
      )
    )
  }

  orWithDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyDateOfBirthBetweenFilter({
          healthcarePartyId: this.hcpId,
          minDateOfBirth: from,
          maxDateOfBirth: to,
        })
      )
    )
  }

  orByDateOfBirth(dateOfBirth: number): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyDateOfBirthFilter({
          healthcarePartyId: this.hcpId,
          dateOfBirth: dateOfBirth,
        })
      )
    )
  }

  orOlderThan(age: number): PatientFilterBuilder {
    return this.add(
      this.withDateOfBirthBetween(
        undefined,
        parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd"))
      )
    )
  }

  orYoungerThan(age: number): PatientFilterBuilder {
    return this.add(
      this.withDateOfBirthBetween(parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd")))
    )
  }

  orByGenderEducationProfession(
    gender?: GenderEnum,
    education?: String,
    profession?: String
  ): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyGenderEducationProfession({
          healthcarePartyId: this.hcpId,
          gender: gender,
          education: education,
          profession: profession,
        })
      )
    )
  }

  orByIds(ids: string[]): PatientFilterBuilder {
    return this.add(new PatientFilterBuilder(new PatientByIdsFilter({ ids: ids })))
  }

  orSearchByName(name: string): PatientFilterBuilder {
    return this.add(
      new PatientFilterBuilder(
        new PatientByHcPartyNameContainsFuzzyFilter({
          healthcarePartyId: this.hcpId,
          searchString: name,
        })
      )
    )
  }

  andActivePatients(): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true })
      ) as AbstractFilterPatient
    )
  }

  andInactivePatients(): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false })
      )
    )
  }

  andWithExternalId(externalId: string): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyAndExternalIdFilter({
          healthcarePartyId: this.hcpId,
          externalId: externalId,
        })
      )
    )
  }

  andWithSsins(ssins: string[]): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins })
      )
    )
  }

  andWithDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyDateOfBirthBetweenFilter({
          healthcarePartyId: this.hcpId,
          minDateOfBirth: from,
          maxDateOfBirth: to,
        })
      )
    )
  }

  andByDateOfBirth(dateOfBirth: number): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyDateOfBirthFilter({
          healthcarePartyId: this.hcpId,
          dateOfBirth: dateOfBirth,
        })
      )
    )
  }

  andOlderThan(age: number): PatientFilterBuilder {
    return this.and(
      this.withDateOfBirthBetween(
        undefined,
        parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd"))
      )
    )
  }

  andYoungerThan(age: number): PatientFilterBuilder {
    return this.and(
      this.withDateOfBirthBetween(parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd")))
    )
  }

  andByGenderEducationProfession(
    gender?: GenderEnum,
    education?: String,
    profession?: String
  ): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyGenderEducationProfession({
          healthcarePartyId: this.hcpId,
          gender: gender,
          education: education,
          profession: profession,
        })
      )
    )
  }

  andByIds(ids: string[]): PatientFilterBuilder {
    return this.and(new PatientFilterBuilder(new PatientByIdsFilter({ ids: ids })))
  }

  andSearchByName(name: string): PatientFilterBuilder {
    return this.and(
      new PatientFilterBuilder(
        new PatientByHcPartyNameContainsFuzzyFilter({
          healthcarePartyId: this.hcpId,
          searchString: name,
        })
      )
    )
  }

  minusActivePatients(): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true })
      ) as AbstractFilterPatient
    )
  }

  minusInactivePatients(): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false })
      )
    )
  }

  minusWithExternalId(externalId: string): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyAndExternalIdFilter({
          healthcarePartyId: this.hcpId,
          externalId: externalId,
        })
      )
    )
  }

  minusWithSsins(ssins: string[]): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins })
      )
    )
  }

  minusWithDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyDateOfBirthBetweenFilter({
          healthcarePartyId: this.hcpId,
          minDateOfBirth: from,
          maxDateOfBirth: to,
        })
      )
    )
  }

  minusByDateOfBirth(dateOfBirth: number): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyDateOfBirthFilter({
          healthcarePartyId: this.hcpId,
          dateOfBirth: dateOfBirth,
        })
      )
    )
  }

  minusOlderThan(age: number): PatientFilterBuilder {
    return this.minus(
      this.withDateOfBirthBetween(
        undefined,
        parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd"))
      )
    )
  }

  minusYoungerThan(age: number): PatientFilterBuilder {
    return this.minus(
      this.withDateOfBirthBetween(parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd")))
    )
  }

  minusByGenderEducationProfession(
    gender?: GenderEnum,
    education?: String,
    profession?: String
  ): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyGenderEducationProfession({
          healthcarePartyId: this.hcpId,
          gender: gender,
          education: education,
          profession: profession,
        })
      )
    )
  }

  minusByIds(ids: string[]): PatientFilterBuilder {
    return this.minus(new PatientFilterBuilder(new PatientByIdsFilter({ ids: ids })))
  }

  minusSearchByName(name: string): PatientFilterBuilder {
    return this.minus(
      new PatientFilterBuilder(
        new PatientByHcPartyNameContainsFuzzyFilter({
          healthcarePartyId: this.hcpId,
          searchString: name,
        })
      )
    )
  }

  build(): AbstractFilterPatient {
    return this.filter || this.all().build()
  }
}
