export class ConstantFilter<T> {
  constructor(constant: T[]) {
    this.constant = constant
  }

  constant?: T[]
  $type = 'ConstantFilter'
}
