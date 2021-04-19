import { AbstractFilter } from "./filters"

export class IntersectionFilter<T> {
  constructor(filters: AbstractFilter<T>[]) {
    this.filters = filters
  }

  filters: AbstractFilter<T>[]
  $type: string = "IntersectionFilter"
}
