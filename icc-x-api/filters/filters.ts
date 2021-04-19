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
  filterProvider?: (builder: FilterBuilder<T>) => AbstractFilter<T>
  composer: (
    thisFilterBuilder: FilterBuilder<T>,
    otherFilterBuilder: FilterBuilder<T>
  ) => FilterBuilder<T> = (
    thisFilterBuilder: FilterBuilder<T>,
    otherFilterBuilder: FilterBuilder<T>
  ) => otherFilterBuilder

  constructor(
    filterProvider?: (builder: FilterBuilder<T>) => AbstractFilter<T>,
    composer?: (
      thisFilterBuilder: FilterBuilder<T>,
      otherFilterBuilder: FilterBuilder<T>
    ) => FilterBuilder<T>
  ) {
    this.filterProvider = filterProvider
    composer && (this.composer = composer)
  }

  clone(
    filterProvider?: (builder: FilterBuilder<T>) => AbstractFilter<T>,
    composer?: (
      thisFilterBuilder: FilterBuilder<T>,
      otherFilterBuilder: FilterBuilder<T>
    ) => FilterBuilder<T>
  ): FilterBuilder<T> {
    return new FilterBuilder(filterProvider, composer)
  }

  isNull(): boolean {
    return !this.filterProvider
  }

  listOf(elements: T[]): FilterBuilder<T> {
    return new FilterBuilder<T>(() => new ConstantFilter<T>(elements) as AbstractFilter<T>)
  }

  and(): FilterBuilder<T> {
    const currentFilter = this.filterProvider?.(this)
    return currentFilter
      ? this.clone(
          (builder: FilterBuilder<T>) => {
            const otherFilter = builder.filterProvider?.(builder)
            return otherFilter
              ? (new IntersectionFilter<T>([currentFilter, otherFilter]) as AbstractFilter<T>)
              : currentFilter
          },
          (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => {
            const thisFilterProvider = thisFilterBuilder.filterProvider
            return thisFilterProvider
              ? this.clone(
                  () => thisFilterProvider(otherFilterBuilder),
                  otherFilterBuilder.composer
                )
              : otherFilterBuilder
          }
        )
      : this
  }

  or(): FilterBuilder<T> {
    const currentFilter = this.filterProvider?.(this)
    return currentFilter
      ? this.clone(
          (builder: FilterBuilder<T>) => {
            const otherFilter = builder.filterProvider?.(builder)
            return otherFilter
              ? (new UnionFilter<T>([currentFilter, otherFilter]) as AbstractFilter<T>)
              : currentFilter
          },
          (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => {
            const thisFilterProvider = thisFilterBuilder.filterProvider
            return thisFilterProvider
              ? this.clone(
                  () => thisFilterProvider(otherFilterBuilder),
                  otherFilterBuilder.composer
                )
              : otherFilterBuilder
          }
        )
      : this
  }

  minus(): FilterBuilder<T> {
    const currentFilter = this.filterProvider?.(this)
    return currentFilter
      ? this.clone(
          (builder: FilterBuilder<T>) => {
            const otherFilter = builder.filterProvider?.(builder)
            return otherFilter
              ? (new ComplementFilter<T>(currentFilter, otherFilter) as AbstractFilter<T>)
              : (new ConstantFilter<T>([]) as AbstractFilter<T>)
          },
          (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => {
            const thisFilterProvider = thisFilterBuilder.filterProvider
            return thisFilterProvider
              ? this.clone(
                  () => thisFilterProvider(otherFilterBuilder),
                  otherFilterBuilder.composer
                )
              : otherFilterBuilder
          }
        )
      : this
  }
}

class PatientFilterBuilder extends FilterBuilder<Patient> {
  hcpId?: string

  constructor(
    filterProvider?: (builder: FilterBuilder<Patient>) => AbstractFilter<Patient>,
    hcpId?: string,
    composer?: (
      thisFilterBuilder: FilterBuilder<Patient>,
      otherFilterBuilder: FilterBuilder<Patient>
    ) => FilterBuilder<Patient>
  ) {
    super(filterProvider, composer)
    this.hcpId = hcpId
  }

  clone(
    filterProvider?: (builder: FilterBuilder<Patient>) => AbstractFilter<Patient>,
    composer?: (
      thisFilterBuilder: FilterBuilder<Patient>,
      otherFilterBuilder: FilterBuilder<Patient>
    ) => FilterBuilder<Patient>
  ): FilterBuilder<Patient> {
    return new PatientFilterBuilder(filterProvider, this.hcpId, composer)
  }

  listOf(elements: Patient[]): PatientFilterBuilder {
    return new PatientFilterBuilder(
      () => new ConstantFilter<Patient>(elements) as AbstractFilter<Patient>
    )
  }

  and(): PatientFilterBuilder {
    return super.and() as PatientFilterBuilder
  }

  or(): PatientFilterBuilder {
    return super.or() as PatientFilterBuilder
  }

  minus(): PatientFilterBuilder {
    return super.minus() as PatientFilterBuilder
  }

  forHcp(hcpId: string): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(this.filterProvider, hcpId)
    ) as PatientFilterBuilder
  }

  all(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () => new PatientByHcPartyFilter({ healthcarePartyId: this.hcpId }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  activePatients(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  inactivePatients(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  withExternalId(externalId: string): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyAndExternalIdFilter({
            healthcarePartyId: this.hcpId,
            externalId: externalId,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  withSsins(ssins: string[]): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () => new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  withDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyDateOfBirthBetweenFilter({
            healthcarePartyId: this.hcpId,
            minDateOfBirth: from,
            maxDateOfBirth: to,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  byDateOfBirth(dateOfBirth: number): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyDateOfBirthFilter({
            healthcarePartyId: this.hcpId,
            dateOfBirth: dateOfBirth,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  olderThan(age: number): PatientFilterBuilder {
    return this.withDateOfBirthBetween(
      undefined,
      parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd"))
    )
  }

  youngerThan(age: number): PatientFilterBuilder {
    return this.withDateOfBirthBetween(
      parseInt(format(add(new Date(), { years: -age }), "yyyyMMdd")),
      99991231
    )
  }

  byGenderEducationProfession(
    gender?: GenderEnum,
    education?: String,
    profession?: String
  ): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyGenderEducationProfession({
            healthcarePartyId: this.hcpId,
            gender: gender,
            education: education,
            profession: profession,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  byIds(ids: string[]): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByIdsFilter({ ids: ids }), this.hcpId)
    ) as PatientFilterBuilder
  }

  searchByName(name: string): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(
        () =>
          new PatientByHcPartyNameContainsFuzzyFilter({
            healthcarePartyId: this.hcpId,
            searchString: name,
          }),
        this.hcpId
      )
    ) as PatientFilterBuilder
  }

  build(): AbstractFilterPatient {
    return this.filterProvider?.(this) || this.all().build()
  }
}
