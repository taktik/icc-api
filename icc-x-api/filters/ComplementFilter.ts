import { AbstractFilter } from './filters'

export class ComplementFilter<T> {
  constructor(superSet: AbstractFilter<T>, subSet: AbstractFilter<T>) {
    this.superSet = superSet
    this.subSet = subSet
  }

  superSet: AbstractFilter<T>
  subSet: AbstractFilter<T>
  $type = 'ComplementFilter'
}
