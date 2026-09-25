import { collection, doc, getDocs, setDoc, deleteDoc, type Firestore } from 'firebase/firestore'
import type { Tenant } from '@/types'
import type { TenantSeed } from './seed-data'

// Grava o seed de uma loja no Firestore. O doc da loja vai POR ÚLTIMO: enquanto
// ele não existe, as regras liberam a carga inicial (ver `bootstrapping` em
// firestore.rules); depois que existe, só a gerência escreve.

const COLLECTIONS = [
  'products', 'insumos', 'stockMoves', 'comandas', 'openComandas', 'orders',
  'cashierSessions', 'cashMovements', 'counters', 'staff', 'staffPins', 'nfce',
] as const

function plain(v: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(v))
}

async function inChunks<T>(list: T[], size: number, fn: (x: T) => Promise<unknown>) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn))
}

export async function writeTenantSeed(db: Firestore, tenant: Tenant, seed: TenantSeed, onProgress?: (msg: string) => void) {
  const base = `tenants/${tenant.slug}`
  for (const name of COLLECTIONS) {
    const list = seed.collections[name] as { id: string }[]
    onProgress?.(`${name}: ${list.length}`)
    await inChunks(list, 20, (item) => {
      const { id, ...data } = item
      return setDoc(doc(db, `${base}/${name}`, id), plain(data))
    })
  }
  onProgress?.('loja')
  await setDoc(doc(db, base), plain({ tenant, settings: seed.settings }))
}

// Recriar dados de exemplo (gerência): apaga a operação e grava o seed de novo.
// A sessão de quem está logado é mantida.
export async function resetTenant(db: Firestore, tenant: Tenant, seed: TenantSeed) {
  const base = `tenants/${tenant.slug}`
  for (const name of COLLECTIONS) {
    if (name === 'staffPins') continue    // ilegível por regra; os PINs do seed são regravados abaixo
    try {
      const snap = await getDocs(collection(db, `${base}/${name}`))
      await inChunks(snap.docs, 20, (d) => deleteDoc(d.ref))
      if (name === 'staff') await inChunks(snap.docs, 20, (d) => deleteDoc(doc(db, `${base}/staffPins`, d.id)))
    } catch (err) {
      throw new Error(`Não foi possível limpar "${name}": ${(err as Error).message}`)
    }
  }
  await writeTenantSeed(db, tenant, seed)
}
