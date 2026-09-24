// localStorage pode falhar (aba anônima, cota); o app segue funcionando sem ele

export function load<T>(key: string, fallback: T, store: Storage = localStorage): T {
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown, store: Storage = localStorage): void {
  try {
    store.setItem(key, JSON.stringify(value))
  } catch { /* sem persistência, sem problema */ }
}

export function remove(key: string, store: Storage = localStorage): void {
  try { store.removeItem(key) } catch { /* idem */ }
}

export function removeByPrefix(prefix: string, store: Storage = localStorage): void {
  try {
    Object.keys(store).filter((k) => k.startsWith(prefix)).forEach((k) => store.removeItem(k))
  } catch { /* idem */ }
}
