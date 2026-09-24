import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import type { Role, StaffUser } from '@/types'
import { firebaseEnabled, firestore, currentUid } from '@/firebase'
import { useCollection } from '@/db/collection'
import { dbContext } from '@/db/context'
import { tenantPath, tenantPrefix } from '@/db/tenant'
import { useTenantBundle } from '@/mock/tenants'
import { load, save, remove } from '@/lib/storage'
import { newId } from '@/lib/ids'

interface StaffSession { userId: string; role: Role }

// Login da equipe por aba. No Firestore, acertar o PIN cria sessions/{uid}: as
// regras conferem o PIN contra staffPins (que ninguém lê) antes de aceitar,
// e todas as coleções da operação exigem essa sessão.
export const useStaffStore = defineStore('staff', () => {
  const bundle = useTenantBundle()
  const coll   = useCollection<StaffUser>('staff', {
    local: () => bundle.staff.map((u) => ({ ...u })),
    sources: () => [{ kind: 'query', key: 'all', constraints: [] }],
  })
  const users = coll.items

  const SESSION_KEY = tenantPrefix() + 'staff-session'
  const session = ref<StaffSession | null>(load<StaffSession | null>(SESSION_KEY, null, sessionStorage))
  dbContext.staffRole = session.value?.role ?? null

  const user    = computed(() => users.value.find((u) => u.id === session.value?.userId) ?? null)
  const role    = computed<Role | null>(() => session.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'gerente')

  function sessionRef() {
    return doc(firestore!, `${tenantPath()}/sessions/${currentUid()}`)
  }

  function start(s: StaffSession) {
    session.value = s
    dbContext.staffRole = s.role
    save(SESSION_KEY, s, sessionStorage)
  }

  async function login(userId: string, pin: string): Promise<boolean> {
    const u = users.value.find((x) => x.id === userId)
    if (!u) return false
    if (!firebaseEnabled) {
      if (u.pin !== pin) return false
      start({ userId, role: u.role })
      return true
    }
    try {
      await deleteDoc(sessionRef()).catch(() => {})
      await setDoc(sessionRef(), { staffId: userId, role: u.role, pin, createdAt: new Date().toISOString() })
      start({ userId, role: u.role })
      return true
    } catch {
      return false   // regra recusou: PIN errado
    }
  }

  async function logout(): Promise<void> {
    session.value = null
    dbContext.staffRole = null
    remove(SESSION_KEY, sessionStorage)
    if (firebaseEnabled) await deleteDoc(sessionRef()).catch(() => {})
  }

  function can(roles?: Role[]): boolean {
    if (!role.value) return false
    return !roles || roles.includes(role.value)
  }

  async function addUser(name: string, role: Role, pin: string): Promise<void> {
    const id = newId()
    if (firebaseEnabled) {
      await coll.add({ id, name, role })
      await setDoc(doc(firestore!, `${tenantPath()}/staffPins/${id}`), { pin })
    } else {
      await coll.add({ id, name, role, pin })
    }
  }

  async function removeUser(id: string): Promise<void> {
    await coll.remove(id)
    if (firebaseEnabled) await deleteDoc(doc(firestore!, `${tenantPath()}/staffPins/${id}`))
  }

  return { users, user, role, isAdmin, login, logout, can, addUser, removeUser, ready: coll.ready }
})

// Tela inicial de cada perfil depois do login
export const homeRoute: Record<Role, string> = {
  cozinha: 'kitchen',
  salao:   'salon',
  caixa:   'admin-comandas',
  gerente: 'admin-dashboard',
}
