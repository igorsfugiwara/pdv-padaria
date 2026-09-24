import { createRouter, createWebHistory } from 'vue-router'
import type { Role } from '@/types'
import { tenants, bootTenantSlug } from '@/mock/tenants'
import { rolesFor } from '@/lib/modules'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { useStaffStore, homeRoute } from '@/stores/useStaffStore'

export type Layout = 'tenants' | 'customer' | 'customer-bare' | 'staff'

declare module 'vue-router' {
  interface RouteMeta {
    layout?: Layout
    requiresComanda?: boolean
    roles?: Role[]
  }
}

const staffRoute = (path: string, name: string, component: () => Promise<unknown>) =>
  ({ path, name, component, meta: { layout: 'staff' as Layout, roles: rolesFor(name) } })

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/', name: 'tenants', component: () => import('@/pages/TenantsPage.vue'), meta: { layout: 'tenants' } },
    {
      path: '/:loja',
      children: [
        // Cliente
        { path: '',         name: 'scan',   component: () => import('@/pages/customer/ScanPage.vue'),   meta: { layout: 'customer-bare' } },
        { path: 'cardapio', name: 'menu',   component: () => import('@/pages/customer/MenuPage.vue'),   meta: { layout: 'customer', requiresComanda: true } },
        { path: 'sacola',   name: 'cart',   component: () => import('@/pages/customer/CartPage.vue'),   meta: { layout: 'customer', requiresComanda: true } },
        { path: 'pedidos',  name: 'orders', component: () => import('@/pages/customer/OrdersPage.vue'), meta: { layout: 'customer', requiresComanda: true } },

        // Equipe
        { path: 'equipe', name: 'staff-login', component: () => import('@/pages/staff/StaffLoginPage.vue'), meta: { layout: 'staff' } },
        staffRoute('cozinha', 'kitchen', () => import('@/pages/staff/KitchenPage.vue')),
        staffRoute('salao',   'salon',   () => import('@/pages/staff/SalonPage.vue')),
        {
          path: 'admin',
          component: () => import('@/pages/admin/AdminLayout.vue'),
          meta: { layout: 'staff' },
          children: [
            staffRoute('',              'admin-dashboard',     () => import('@/pages/admin/DashboardPage.vue')),
            staffRoute('comandas',      'admin-comandas',      () => import('@/pages/admin/ComandasPage.vue')),
            staffRoute('caixa',         'admin-caixa',         () => import('@/pages/admin/CashierPage.vue')),
            staffRoute('cardapio',      'admin-cardapio',      () => import('@/pages/admin/MenuAdminPage.vue')),
            staffRoute('estoque',       'admin-estoque',       () => import('@/pages/admin/StockPage.vue')),
            staffRoute('relatorios',    'admin-relatorios',    () => import('@/pages/admin/ReportsPage.vue')),
            staffRoute('configuracoes', 'admin-configuracoes', () => import('@/pages/admin/SettingsPage.vue')),
          ],
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  if (to.name === 'tenants') return

  const slug = String(to.params.loja ?? '')
  if (!tenants[slug]) return { name: 'tenants' }
  // As stores nascem com a loja da carga da página; trocar de loja recarrega o app
  if (slug !== bootTenantSlug()) {
    window.location.assign(to.fullPath)
    return false
  }

  // A equipe primeiro: o perfil da aba decide o que as coleções assinam
  const staff = useStaffStore()

  // Cliente: sem comanda aberta não há cardápio
  const customer = useCustomerStore()
  if (to.meta.requiresComanda || to.name === 'scan') await customer.resolve()
  if (to.meta.requiresComanda && !customer.isActive) {
    return { name: 'scan', params: { loja: slug }, query: customer.wasClosed ? { encerrada: '1' } : {} }
  }
  if (to.name === 'scan' && customer.isActive && !to.query.c) {
    return { name: 'menu', params: { loja: slug } }
  }

  // Equipe: login por aba e permissão por perfil
  if (to.name === 'staff-login' && staff.role) {
    return { name: homeRoute[staff.role], params: { loja: slug } }
  }
  if (to.meta.roles) {
    if (!staff.role) return { name: 'staff-login', params: { loja: slug }, query: { redirect: to.fullPath } }
    if (!staff.can(to.meta.roles)) return { name: homeRoute[staff.role], params: { loja: slug } }
  }
})

export default router
