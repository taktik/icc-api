import { ConstantFilter } from './ConstantFilter'
import { Patient } from '../../icc-api/model/Patient'
import { AbstractFilterPatient } from '../../icc-api/model/AbstractFilterPatient'
import { AbstractFilterContact } from '../../icc-api/model/AbstractFilterContact'
import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'
import { Service } from '../../icc-api/model/Service'
import { Contact } from '../../icc-api/model/Contact'
import { IntersectionFilter } from './IntersectionFilter'
import { UnionFilter } from './UnionFilter'
import { ComplementFilter } from './ComplementFilter'
import { PatientByHcPartyAndActiveFilter } from './PatientByHcPartyAndActiveFilter'
import { PatientByHcPartyAndExternalIdFilter } from './PatientByHcPartyAndExternalIdFilter'
import { PatientByHcPartyAndSsinsFilter } from './PatientByHcPartyAndSsinsFilter'
import { PatientByHcPartyDateOfBirthBetweenFilter } from './PatientByHcPartyDateOfBirthBetweenFilter'
import { PatientByHcPartyDateOfBirthFilter } from './PatientByHcPartyDateOfBirthFilter'

import { add, format } from 'date-fns'
import { PatientByHcPartyFilter } from './PatientByHcPartyFilter'
import { PatientByHcPartyGenderEducationProfession } from './PatientByHcPartyGenderEducationProfession'
import { PatientByIdsFilter } from './PatientByIdsFilter'
import { PatientByHcPartyNameContainsFuzzyFilter } from './PatientByHcPartyNameContainsFuzzyFilter'
import GenderEnum = Patient.GenderEnum

export * from './PatientByHcPartyAndActiveFilter'
export * from './PatientByHcPartyAndExternalIdFilter'
export * from './PatientByHcPartyAndSsinsFilter'
export * from './PatientByHcPartyDateOfBirthBetweenFilter'
export * from './PatientByHcPartyDateOfBirthFilter'
export * from './PatientByHcPartyFilter'
export * from './PatientByHcPartyGenderEducationProfession'
export * from './PatientByHcPartyNameContainsFuzzyFilter'
export * from './PatientByHcPartyNameFilter'
export * from './PatientByIdsFilter'

export class Filter {
  public static patient(): PatientFilterBuilder {
    return new PatientFilterBuilder()
  }
}

export type AbstractFilter<T> = T extends Patient
  ? AbstractFilterPatient | ConstantFilter<T> | IntersectionFilter<T> | UnionFilter<T> | ComplementFilter<T>
  : T extends Contact
  ? AbstractFilterContact | ConstantFilter<T> | IntersectionFilter<T> | UnionFilter<T> | ComplementFilter<T>
  : T extends Service
  ? AbstractFilterService | ConstantFilter<T> | IntersectionFilter<T> | UnionFilter<T> | ComplementFilter<T>
  : ConstantFilter<T> | IntersectionFilter<T> | UnionFilter<T> | ComplementFilter<T>

abstract class FilterBuilder<T> {
  filterProvider?: () => AbstractFilter<T>
  composer: (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => FilterBuilder<T> = (
    thisFilterBuilder: FilterBuilder<T>,
    otherFilterBuilder: FilterBuilder<T>
  ) => otherFilterBuilder

  protected constructor(
    filterProvider?: () => AbstractFilter<T>,
    composer?: (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => FilterBuilder<T>
  ) {
    this.filterProvider = filterProvider
    composer && (this.composer = composer)
  }

  abstract build(): AbstractFilter<T>

  abstract clone(
    filterProvider?: () => AbstractFilter<T>,
    composer?: (thisFilterBuilder: FilterBuilder<T>, otherFilterBuilder: FilterBuilder<T>) => FilterBuilder<T>
  ): FilterBuilder<T>

  listOf(elements: T[]): FilterBuilder<T> {
    return this.clone(() => new ConstantFilter<T>(elements) as AbstractFilter<T>)
  }

  private makeLazyLeftRightFilterBuilder(
    leftHandRightHandFiltersCombiner: (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () => AbstractFilter<T>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const leftHandFilterBuilder: FilterBuilder<T> = this

    return leftHandFilterBuilder.filterProvider
      ? this.clone(
          undefined, //filter provider is indeterminate until we have performed a composition
          (orFilterBuilder: FilterBuilder<T>, rightHandFilterBuilder: FilterBuilder<T>) => {
            const leftHandFilter = leftHandFilterBuilder.build()
            const rightHandFilter = rightHandFilterBuilder.build()

            return rightHandFilter
              ? this.clone(leftHandRightHandFiltersCombiner(leftHandFilter, rightHandFilter), rightHandFilterBuilder.composer)
              : rightHandFilterBuilder
          }
        )
      : this
  }

  private makeEagerLeftRightFilterBuilder(
    rightHandFilterBuilderFactory: (it: FilterBuilder<T>) => FilterBuilder<T>,
    leftHandRightHandFiltersCombiner: (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () => AbstractFilter<T>
  ) {
    const rightHandFilterBuilder = rightHandFilterBuilderFactory(this)
    return this.filterProvider ? this.clone(leftHandRightHandFiltersCombiner(this.build(), rightHandFilterBuilder.build())) : this
  }

  and(filterBuilderFactory?: () => FilterBuilder<T>): FilterBuilder<T> {
    const combiner = (leftHandFilter: AbstractFilter<T>, rightHandFilter: AbstractFilter<T>) => () =>
      new IntersectionFilter<T>([leftHandFilter, rightHandFilter]) as AbstractFilter<T>

    return filterBuilderFactory ? this.makeEagerLeftRightFilterBuilder(filterBuilderFactory, combiner) : this.makeLazyLeftRightFilterBuilder(combiner)
  }

  or(): FilterBuilder<T> {
    return this.makeLazyLeftRightFilterBuilder((leftHandFilter, rightHandFilter) => () =>
      new UnionFilter<T>([leftHandFilter, rightHandFilter]) as AbstractFilter<T>
    )
  }

  minus(): FilterBuilder<T> {
    return this.makeLazyLeftRightFilterBuilder((leftHandFilter, rightHandFilter) => () =>
      new ComplementFilter<T>(leftHandFilter, rightHandFilter) as AbstractFilter<T>
    )
  }
}

class PatientFilterBuilder extends FilterBuilder<Patient> {
  hcpId?: string

  constructor(
    filterProvider?: () => AbstractFilter<Patient>,
    hcpId?: string,
    composer?: (thisFilterBuilder: FilterBuilder<Patient>, otherFilterBuilder: FilterBuilder<Patient>) => FilterBuilder<Patient>
  ) {
    super(filterProvider, composer)
    this.hcpId = hcpId
  }

  clone(
    filterProvider?: () => AbstractFilter<Patient>,
    composer?: (thisFilterBuilder: FilterBuilder<Patient>, otherFilterBuilder: FilterBuilder<Patient>) => FilterBuilder<Patient>
  ): FilterBuilder<Patient> {
    return new PatientFilterBuilder(filterProvider, this.hcpId, composer)
  }

  listOf(elements: Patient[]): PatientFilterBuilder {
    return new PatientFilterBuilder(() => new ConstantFilter<Patient>(elements) as AbstractFilter<Patient>)
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
    return this.composer(this, new PatientFilterBuilder(this.filterProvider, hcpId)) as PatientFilterBuilder
  }

  all(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByHcPartyFilter({ healthcarePartyId: this.hcpId }), this.hcpId)
    ) as PatientFilterBuilder
  }

  activePatients(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: true }), this.hcpId)
    ) as PatientFilterBuilder
  }

  inactivePatients(): PatientFilterBuilder {
    return this.composer(
      this,
      new PatientFilterBuilder(() => new PatientByHcPartyAndActiveFilter({ healthcarePartyId: this.hcpId, active: false }), this.hcpId)
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
      new PatientFilterBuilder(() => new PatientByHcPartyAndSsinsFilter({ healthcarePartyId: this.hcpId, ssins: ssins }), this.hcpId)
    ) as PatientFilterBuilder
  }

  withDateOfBirthBetween(from?: number, to?: number): PatientFilterBuilder {
    return this.composer(
      this,
      this.clone(
        () =>
          new PatientByHcPartyDateOfBirthBetweenFilter({
            healthcarePartyId: this.hcpId,
            minDateOfBirth: from,
            maxDateOfBirth: to,
          })
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
    return this.withDateOfBirthBetween(10000101, parseInt(format(add(new Date(), { years: -age }), 'yyyyMMdd')))
  }

  youngerThan(age: number): PatientFilterBuilder {
    return this.withDateOfBirthBetween(parseInt(format(add(new Date(), { years: -age }), 'yyyyMMdd')), 99991231)
  }

  byGenderEducationProfession(gender?: GenderEnum, education?: string, profession?: string): PatientFilterBuilder {
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
    return this.composer(this, new PatientFilterBuilder(() => new PatientByIdsFilter({ ids: ids }), this.hcpId)) as PatientFilterBuilder
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

  build(): AbstractFilter<Patient> {
    return this.filterProvider?.() || this.all().build()
  }
}
