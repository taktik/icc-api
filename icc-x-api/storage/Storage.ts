export interface Storage {
  getItem(key: string): string | null

  setItem(key: string, value: string): void

  removeItem(key: string): void
}

export class StorageUtils implements Storage {
  getItem(key: string): string | null {
    return localStorage.getItem(key)
  }

  removeItem(key: string): void {
    return localStorage.removeItem(key)
  }

  setItem(key: string, value: string): void {
    return localStorage.setItem(key, value)
  }
}
