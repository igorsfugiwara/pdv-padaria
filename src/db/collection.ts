import { ref, watch, type Ref } from 'vue'
import {
  collection, doc, onSnapshot, query, setDoc, updateDoc, deleteDoc, deleteField, increment as fsIncrement,
  type QueryConstraint, type Unsubscribe, type DocumentReference, type CollectionReference,
} from 'firebase/firestore'
import { firestore, firebaseEnabled } from '@/firebase'
import { load, save } from '@/lib/storage'
import { tenantPath, tenantPrefix } from './tenant'

// Uma fonte de dados de uma coleção no Firestore: uma consulta ou um doc por id
export type Source =
  | { kind: 'query'; key: string; constraints: QueryConstraint[] }
  | { kind: 'doc'; id: string }

export interface Collection<T extends { id: string }> {
  items: Ref<T[]>
  /** Persiste as mudanças feitas em `items` (só os campos alterados). */
  commit(): Promise<void>
  /** Adiciona e persiste um item novo. */
  add(item: T): Promise<void>
  /** Remove e apaga um item. */
  remove(id: string): Promise<void>
  /** Soma atômica num campo numérico (estoque). */
  increment(id: string, field: string, delta: number): Promise<void>
  /** Mostra um item já gravado por fora (transação) antes de o snapshot chegar. */
  addLocal(item: T): void
  /** Resolve quando as fontes atuais carregaram pela primeira vez. */
  ready(): Promise<void>
  colRef(): CollectionReference
  docRef(id: string): DocumentReference
}

const clone = <V>(v: V): V => JSON.parse(JSON.stringify(v))

function stripId<T extends { id: string }>(item: T): Record<string, unknown> {
  const { id: _id, ...data } = item
  return JSON.parse(JSON.stringify(data))
}

function reportError(action: string, name: string, err: unknown) {
  console.error(`[db] ${action} ${name}:`, err)
  window.dispatchEvent(new CustomEvent('db-error', { detail: { action, name, err } }))
}

export function useCollection<T extends { id: string }>(
  name: string,
  opts: { local: () => T[]; sources: () => Source[] },
): Collection<T> {
  return firebaseEnabled ? firestoreCollection<T>(name, opts.sources) : localCollection<T>(name, opts.local)
}

// ─── Modo mock: localStorage, sincronizado entre abas ────────────────────────

function localCollection<T extends { id: string }>(name: string, seed: () => T[]): Collection<T> {
  const key   = tenantPrefix() + name
  const items = ref(load<T[] | null>(key, null) ?? seed()) as Ref<T[]>
  const persist = () => save(key, items.value)

  window.addEventListener('storage', (e) => {
    if (e.key !== key) return
    if (e.newValue === null) { window.location.reload(); return }
    try { items.value = JSON.parse(e.newValue) } catch { /* escrita parcial */ }
  })

  return {
    items,
    commit: async () => persist(),
    add: async (item) => { items.value.push(item); persist() },
    remove: async (id) => { items.value = items.value.filter((i) => i.id !== id); persist() },
    increment: async (id, field, delta) => {
      const it = items.value.find((i) => i.id === id) as Record<string, unknown> | undefined
      if (it) it[field] = Math.round(((it[field] as number) + delta) * 1000) / 1000
      persist()
    },
    addLocal: (item) => { if (!items.value.some((i) => i.id === item.id)) items.value.push(item) },
    ready: async () => {},
    colRef: () => { throw new Error('Firestore desligado') },
    docRef: () => { throw new Error('Firestore desligado') },
  }
}

// ─── Firestore: assinaturas por fonte + gravação por diferença ───────────────

function firestoreCollection<T extends { id: string }>(name: string, sources: () => Source[]): Collection<T> {
  const col   = () => collection(firestore!, `${tenantPath()}/${name}`)
  const items = ref<T[]>([]) as Ref<T[]>

  const bySource = new Map<string, Map<string, T>>()   // docs de cada fonte
  const unsubs   = new Map<string, Unsubscribe>()
  const synced   = new Map<string, T>()                // último estado conhecido no servidor (para o diff)
  const pending  = new Map<string, T>()                // criados aqui, ainda sem snapshot
  let waiting    = new Set<string>()
  let readyWaiters: (() => void)[] = []

  function rebuild() {
    const merged = new Map<string, T>()
    for (const m of bySource.values()) for (const [id, d] of m) merged.set(id, d)
    for (const [id, d] of pending) if (!merged.has(id)) merged.set(id, d)
    items.value = [...merged.values()]
  }

  function loaded(key: string) {
    waiting.delete(key)
    if (!waiting.size) { readyWaiters.forEach((r) => r()); readyWaiters = [] }
  }

  function keyOf(s: Source): string {
    return s.kind === 'doc' ? `doc:${s.id}` : `query:${s.key}`
  }

  function receive(key: string, docs: [string, Record<string, unknown>][]) {
    const m = new Map<string, T>()
    for (const [id, data] of docs) {
      const item = { ...data, id } as T
      m.set(id, item)
      synced.set(id, clone(item))
      pending.delete(id)
    }
    bySource.set(key, m)
    rebuild()
    loaded(key)
  }

  function sync(list: Source[]) {
    const next = new Map(list.map((s) => [keyOf(s), s]))
    // encerra fontes que saíram
    for (const [key, unsub] of unsubs) {
      if (!next.has(key)) { unsub(); unsubs.delete(key); bySource.delete(key) }
    }
    waiting = new Set([...next.keys()].filter((k) => !unsubs.has(k)))
    for (const [key, s] of next) {
      if (unsubs.has(key)) continue
      const onError = (err: unknown) => { reportError('assinar', name, err); loaded(key) }
      const unsub = s.kind === 'doc'
        ? onSnapshot(doc(col(), s.id), (snap) => receive(key, snap.exists() ? [[snap.id, snap.data()]] : []), onError)
        : onSnapshot(query(col(), ...s.constraints), (snap) => receive(key, snap.docs.map((d) => [d.id, d.data()])), onError)
      unsubs.set(key, unsub)
    }
    rebuild()
    if (!waiting.size) loaded('')
  }

  watch(() => sources(), (list) => sync(list), { immediate: true, deep: false })

  async function write(action: string, p: Promise<unknown>) {
    try { await p } catch (err) { reportError(action, name, err) }
  }

  async function commit() {
    const writes: Promise<void>[] = []
    for (const item of items.value) {
      const prev = synced.get(item.id)
      const data = stripId(item)
      if (!prev) {
        synced.set(item.id, clone(item))
        writes.push(write('criar', setDoc(doc(col(), item.id), data)))
        continue
      }
      const before = stripId(prev)
      const patch: Record<string, unknown> = {}
      for (const k of new Set([...Object.keys(data), ...Object.keys(before)])) {
        if (JSON.stringify(data[k]) !== JSON.stringify(before[k])) patch[k] = k in data ? data[k] : deleteField()
      }
      if (Object.keys(patch).length) {
        synced.set(item.id, clone(item))
        writes.push(write('atualizar', updateDoc(doc(col(), item.id), patch)))
      }
    }
    await Promise.all(writes)
  }

  return {
    items,
    commit,
    add: async (item) => {
      pending.set(item.id, item)
      synced.set(item.id, clone(item))
      rebuild()
      await write('criar', setDoc(doc(col(), item.id), stripId(item)))
    },
    remove: async (id) => {
      pending.delete(id)
      synced.delete(id)
      for (const m of bySource.values()) m.delete(id)
      rebuild()
      await write('apagar', deleteDoc(doc(col(), id)))
    },
    increment: async (id, field, delta) => {
      const it = items.value.find((i) => i.id === id) as Record<string, unknown> | undefined
      const sy = synced.get(id) as Record<string, unknown> | undefined
      const bump = (o?: Record<string, unknown>) => { if (o) o[field] = Math.round(((o[field] as number) + delta) * 1000) / 1000 }
      bump(it)
      bump(sy)
      await write('incrementar', updateDoc(doc(col(), id), { [field]: fsIncrement(delta) }))
    },
    addLocal: (item) => {
      pending.set(item.id, item)
      synced.set(item.id, clone(item))
      rebuild()
    },
    ready: () => (waiting.size ? new Promise<void>((r) => readyWaiters.push(r)) : Promise.resolve()),
    colRef: col,
    docRef: (id) => doc(col(), id),
  }
}
