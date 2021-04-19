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

  build(): AbstractFilterPatient {
    return this.filter || this.all().build()
  }
}
