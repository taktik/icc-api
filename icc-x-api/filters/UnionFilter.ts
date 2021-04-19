import { AbstractFilter } from "./filters"

export class UnionFilter<T> {
  constructor(filters: AbstractFilter<T>[]) {
    this.filters = filters
  }

  filters: AbstractFilter<T>[]
  $type: string = "UnionFilter"
}
