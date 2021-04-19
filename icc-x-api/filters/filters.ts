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
  builder?: (builder: FilterBuilder<T>) => AbstractFilter<T>

  constructor(builder?: (builder: FilterBuilder<T>) => AbstractFilter<T>) {
    this.builder = builder
  }

  build(): AbstractFilter<T> | undefined {
    return this.builder?.(this)
  }

  isNull(): boolean {
    return !this.builder
  }

  listOf(elements: T[]): FilterBuilder<T> {
    return new FilterBuilder<T>(() => new ConstantFilter<T>(elements) as AbstractFilter<T>)
  }

  and(): FilterBuilder<T> {
    const currentFilter = this.build()
    return currentFilter
      ? new FilterBuilder<T>((builder: FilterBuilder<T>) => {
          const otherFilter = builder.build()
          return otherFilter
            ? (new IntersectionFilter<T>([currentFilter, otherFilter]) as AbstractFilter<T>)
            : currentFilter
        })
      : this
  }

  or(): FilterBuilder<T> {
    const currentFilter = this.build()
    return currentFilter
      ? new FilterBuilder<T>((builder: FilterBuilder<T>) => {
          const otherFilter = builder.build()
          return otherFilter
            ? (new UnionFilter<T>([currentFilter, otherFilter]) as AbstractFilter<T>)
            : currentFilter
        })
      : this
  }

  minus(): FilterBuilder<T> {
    const currentFilter = this.build()
    return currentFilter
      ? new FilterBuilder<T>((builder: FilterBuilder<T>) => {
          const otherFilter = builder.build()
          return otherFilter
            ? (new ComplementFilter<T>(currentFilter, otherFilter) as AbstractFilter<T>)
            : currentFilter
        })
      : this.listOf([])
  }
}

class PatientFilterBuilder extends FilterBuilder<Patient> {
  hcpId?: string

  constructor(
    builder?: (builder: FilterBuilder<Patient>) => AbstractFilter<Patient>,
    hcpId?: string
  ) {
    super(builder)
    this.hcpId = hcpId
  }

  listOf(elements: Patient[]): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () => new ConstantFilter<Patient>(elements) as AbstractFilter<Patient>
    )
  }

  and(): PatientFilterBuilder {
    const currentFilter = this.build()
    return currentFilter
      ? new PatientFilterBuilder((builder: FilterBuilder<Patient>) => {
          const otherFilter = builder.build()
          return otherFilter
            ? (new IntersectionFilter<Patient>([
                currentFilter,
                otherFilter,
              ]) as AbstractFilter<Patient>)
            : currentFilter
        }, this.hcpId)
      : this
  }

  or(): PatientFilterBuilder {
    const currentFilter = this.build()
    return currentFilter
      ? new PatientFilterBuilder((builder: FilterBuilder<Patient>) => {
          const otherFilter = builder.build()
          return otherFilter
            ? (new UnionFilter<Patient>([currentFilter, otherFilter]) as AbstractFilter<Patient>)
            : currentFilter
        }, this.hcpId)
      : this
  }

  minus(): PatientFilterBuilder {
    const currentFilter = this.build()
    return currentFilter
      ? new PatientFilterBuilder((builder: FilterBuilder<Patient>) => {
          const otherFilter = builder.build()
          return otherFilter
            ? (new ComplementFilter<Patient>(currentFilter, otherFilter) as AbstractFilter<Patient>)
            : currentFilter
        }, this.hcpId)
      : this.listOf([])
  }

  forHcp(hcpId: string): PatientFilterBuilder {
    return new PatientFilterBuilder(this.builder, hcpId)
  }

  all(): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () => new PatientByHcPartyFilter({ healthcarePartyId: this.hcpId }),
      this.hcpId
    )
  }

  activePatients(): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true }),
      this.hcpId
    )
  }

  inactivePatients(): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false }),
      this.hcpId
    )
  }

  withExternalId(externalId: string): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () =>
        new PatientByHcPartyAndExternalIdFilter({
          healthcarePartyId: this.hcpId,
          externalId: externalId,
        }),
      this.hcpId
    )
  }

  withSsins(ssins: string[]): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () => new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins }),
      this.hcpId
    )
  }

  withDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () =>
        new PatientByHcPartyDateOfBirthBetweenFilter({
          healthcarePartyId: this.hcpId,
          minDateOfBirth: from,
          maxDateOfBirth: to,
        }),
      this.hcpId
    )
  }

  byDateOfBirth(dateOfBirth: number): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () =>
        new PatientByHcPartyDateOfBirthFilter({
          healthcarePartyId: this.hcpId,
          dateOfBirth: dateOfBirth,
        }),
      this.hcpId
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
      () =>
        new PatientByHcPartyGenderEducationProfession({
          healthcarePartyId: this.hcpId,
          gender: gender,
          education: education,
          profession: profession,
        }),
      this.hcpId
    )
  }

  byIds(ids: string[]): PatientFilterBuilder {
    return new PatientFilterBuilder(() => new PatientByIdsFilter({ ids: ids }), this.hcpId)
  }

  searchByName(name: string): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () =>
        new PatientByHcPartyNameContainsFuzzyFilter({
          healthcarePartyId: this.hcpId,
          searchString: name,
        }),
      this.hcpId
    )
  }

  build(): AbstractFilterPatient {
    return this.builder?.(this) || this.all().build()
  }
}
