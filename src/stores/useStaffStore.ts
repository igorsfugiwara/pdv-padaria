import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Role, StaffUser } from '@/types'
import { persisted, tenantPrefix } from '@/db/persisted'
import { useTenantBundle } from '@/mock/tenants'
import { load, save, remove } from '@/lib/storage'
import { newId } from '@/lib/ids'

// Login da equipe por aba (sessionStorage): dá para ter cozinha, salão e caixa
// abertos no mesmo navegador, cada um com seu perfil. Mock: PIN em texto, sem backend.
export const useStaffStore = defineStore('staff', () => {
  const bundle = useTenantBundle()
  const { data: users, commit } = persisted<StaffUser[]>('staff', () => bundle.staff.map((u) => ({ ...u })))

  const SESSION_KEY = tenantPrefix() + 'staff-session'
  const sessionUserId = ref<string | null>(load<string | null>(SESSION_KEY, null, sessionStorage))

  const user    = computed(() => users.value.find((u) => u.id === sessionUserId.value) ?? null)
  const role    = computed<Role | null>(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'gerente')

  function login(userId: string, pin: string): boolean {
    const u = users.value.find((x) => x.id === userId)
    if (!u || u.pin !== pin) return false
    sessionUserId.value = u.id
    save(SESSION_KEY, u.id, sessionStorage)
    return true
  }

  function logout(): void {
    sessionUserId.value = null
    remove(SESSION_KEY, sessionStorage)
  }

  function can(roles?: Role[]): boolean {
    if (!role.value) return false
    return !roles || roles.includes(role.value)
  }

  function addUser(name: string, role: Role, pin: string): void {
    users.value.push({ id: newId(), name, role, pin })
    commit()
  }

  function removeUser(id: string): void {
    users.value = users.value.filter((u) => u.id !== id)
    commit()
  }

  return { users, user, role, isAdmin, login, logout, can, addUser, removeUser }
})

// Tela inicial de cada perfil depois do login
export const homeRoute: Record<Role, string> = {
  cozinha: 'kitchen',
  salao:   'salon',
  caixa:   'admin-comandas',
  gerente: 'admin-dashboard',
}
