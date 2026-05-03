import { beforeEach, vi } from 'vitest'

function makeStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage())
  vi.stubGlobal('sessionStorage', makeStorage())
})
