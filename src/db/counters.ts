import { doc, runTransaction } from 'firebase/firestore'
import { firebaseEnabled, firestore } from '@/firebase'
import { tenantPath } from './tenant'
import { dayKey } from './seed-data'

// Próximo número de uma sequência (senha do dia, NFC-e, venda direta).
// No Firestore é uma transação, para dois aparelhos nunca pegarem o mesmo número.
// `daily` zera a contagem a cada dia. `localNext` calcula no modo mock.
export async function nextSequence(name: string, daily: boolean, localNext: () => number): Promise<number> {
  if (!firebaseEnabled) return localNext()
  const ref = doc(firestore!, `${tenantPath()}/counters/${name}`)
  return runTransaction(firestore!, async (tx) => {
    const snap = await tx.get(ref)
    const today = dayKey()
    const data = snap.exists() ? snap.data() : null
    const seq = (data && (!daily || data.day === today) ? data.seq : 0) + 1
    tx.set(ref, daily ? { day: today, seq } : { seq })
    return seq
  })
}
