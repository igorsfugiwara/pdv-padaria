<template>
  <div class="admin">
    <aside :class="['sidebar', { 'sidebar--open': sidebarOpen }]">
      <div class="sidebar__header">
        <span class="sidebar__logo" aria-hidden="true">{{ tenant.logoEmoji }}</span>
        <div>
          <strong class="sidebar__name">{{ tenant.name }}</strong>
          <span class="sidebar__tag">Administrativo</span>
        </div>
      </div>

      <nav class="sidebar__nav" aria-label="Navegação do administrativo">
        <template v-for="group in groups" :key="group.id">
          <p v-if="group.items.length" class="sidebar__group">{{ group.label }}</p>
          <RouterLink
            v-for="m in group.items"
            :key="m.route"
            class="sidebar__link"
            :to="{ name: m.route }"
            @click="sidebarOpen = false"
          >
            <span class="sidebar__icon">{{ m.icon }}</span> {{ m.label }}
            <span v-if="m.route === 'admin-estoque' && catalog.lowStock.length" class="sidebar__badge">{{ catalog.lowStock.length }}</span>
            <span v-if="m.route === 'admin-comandas' && comandas.openSessions.length" class="sidebar__count">{{ comandas.openSessions.length }}</span>
            <span v-if="m.route === 'salon' && readyCount" class="sidebar__badge sidebar__badge--gold">{{ readyCount }}</span>
          </RouterLink>
        </template>
      </nav>

      <div class="sidebar__footer">
        <div class="sidebar__user">
          <span class="sidebar__user-name">{{ staff.user?.name }}</span>
          <span class="sidebar__user-role">{{ staff.role ? roleLabels[staff.role] : '' }}</span>
        </div>
        <button class="sidebar__logout" @click="logout" aria-label="Sair" title="Sair">↪</button>
      </div>
    </aside>
    <div v-if="sidebarOpen" class="sidebar__backdrop" @click="sidebarOpen = false" />

    <div class="admin__content">
      <header class="topbar">
        <button class="topbar__menu" @click="sidebarOpen = !sidebarOpen" aria-label="Abrir menu">☰</button>
        <span class="topbar__title">{{ title }}</span>
        <div class="topbar__right">
          <RouterLink v-if="cashier.active" :to="{ name: 'admin-caixa' }" class="topbar__session">
            <span class="topbar__dot" aria-hidden="true" />
            <span class="topbar__session-text">Caixa aberto — {{ cashier.active.operator }}</span>
          </RouterLink>
          <RouterLink v-else :to="{ name: 'admin-caixa' }" class="topbar__session topbar__session--closed">Caixa fechado</RouterLink>
        </div>
      </header>
      <main class="admin__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useCatalogStore }  from '@/stores/useCatalogStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useCashierStore }  from '@/stores/useCashierStore'
import { useOrderStore }    from '@/stores/useOrderStore'
import { modulesFor, modules } from '@/lib/modules'
import { roleLabels } from '@/lib/format'

const staff    = useStaffStore()
const tenant   = useSettingsStore().tenant
const catalog  = useCatalogStore()
const comandas = useComandasStore()
const cashier  = useCashierStore()
const orders   = useOrderStore()
const route    = useRoute()
const router   = useRouter()

const sidebarOpen = ref(false)

const allowed = computed(() => modulesFor(staff.role))
const groups  = computed(() => [
  { id: 'gestao',   label: 'Gestão',   items: allowed.value.filter((m) => m.group === 'gestao') },
  { id: 'operacao', label: 'Operação', items: allowed.value.filter((m) => m.group === 'operacao') },
])

const title      = computed(() => modules.find((m) => m.route === route.name)?.label ?? '')
const readyCount = computed(() => orders.active.filter((o) => o.status === 'ready').length)

function logout() {
  staff.logout()
  router.push({ name: 'staff-login' })
}
</script>

<style lang="scss" scoped>
.admin {
  display: flex;
  min-height: 100vh;

  &__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding-left: var(--sidebar-width);
    @media (max-width: 1023px) { padding-left: 0; }
  }

  &__main { flex: 1; padding-top: var(--topbar-height); }
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 50;
  transition: transform var(--transition);

  @media (max-width: 1023px) {
    transform: translateX(-100%);
    &--open { transform: translateX(0); }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg) var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  &__logo {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--color-primary);
    font-size: 1.125rem;
    @include flex-center;
    flex-shrink: 0;
  }

  &__name { display: block; font-family: var(--font-display); font-size: 1.25rem; line-height: 1.1; }
  &__tag  { display: block; font-size: 0.625rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-accent-text); font-weight: 600; }

  &__nav {
    flex: 1;
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }

  &__group {
    padding: var(--spacing-md) var(--spacing-sm) var(--spacing-xs);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  &__link {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 10px var(--spacing-sm);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: 0.9375rem;
    font-weight: 500;
    transition: background var(--transition), color var(--transition);

    &:hover { background: var(--color-surface-alt); color: var(--color-text); }
    &.router-link-exact-active { background: var(--color-primary-soft); color: var(--color-accent-text); }
  }

  &__icon  { width: 18px; text-align: center; flex-shrink: 0; }
  &__badge { margin-left: auto; background: var(--color-danger); color: #fff; font-size: 0.6875rem; font-weight: 700; border-radius: 99px; padding: 1px 7px; min-width: 18px; text-align: center; }
  &__badge--gold { background: var(--color-primary); color: var(--color-text-inverse); }
  &__count { margin-left: auto; font-size: 0.75rem; color: var(--color-text-muted); font-family: var(--font-mono); }

  &__footer {
    padding: var(--spacing-md);
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  &__user { flex: 1; overflow: hidden; }
  &__user-name { display: block; font-size: 0.875rem; font-weight: 500; @include truncate; }
  &__user-role { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

  &__logout {
    @include button-reset;
    color: var(--color-text-muted);
    font-size: 1.125rem;
    padding: 6px;
    border-radius: var(--radius-sm);
    &:hover { color: var(--color-danger); background: var(--color-danger-soft); }
  }

  &__backdrop {
    display: none;
    @media (max-width: 1023px) {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 49;
    }
  }
}

.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--topbar-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-md);
  z-index: 40;
  @media (min-width: 1024px) { left: var(--sidebar-width); }

  &__menu {
    @include button-reset;
    color: var(--color-text-muted);
    font-size: 1.25rem;
    padding: 6px;
    &:hover { color: var(--color-text); }
    @media (min-width: 1024px) { display: none; }
  }

  &__title { font-weight: 600; font-size: 1.0625rem; }
  &__right { margin-left: auto; display: flex; align-items: center; gap: var(--spacing-md); }

  &__session {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: var(--color-success);
    &--closed { color: var(--color-text-muted); }
  }

  &__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--color-success); }
  &__session-text { @media (max-width: 479px) { display: none; } }
}
</style>
