<template>
  <header class="staff-header">
    <button class="staff-header__menu" aria-label="Trocar de módulo" @click="open = !open">
      <span aria-hidden="true">☰</span>
    </button>
    <div class="staff-header__title">
      <span class="staff-header__store">{{ tenant.name }}</span>
      <h1>{{ title }}</h1>
    </div>
    <div class="staff-header__slot"><slot /></div>
    <span class="staff-header__clock num">{{ clock }}</span>

    <Transition name="menu">
      <div v-if="open" class="module-menu" @click.self="open = false">
        <nav class="module-menu__panel" aria-label="Módulos">
          <p class="module-menu__user">
            <span class="module-menu__avatar">{{ staff.user?.name.charAt(0) }}</span>
            <span>
              <strong>{{ staff.user?.name }}</strong>
              <small>{{ staff.role ? roleLabels[staff.role] : '' }}</small>
            </span>
          </p>
          <RouterLink
            v-for="m in available"
            :key="m.route"
            :to="{ name: m.route }"
            class="module-menu__link"
            @click="open = false"
          >
            <span class="module-menu__icon">{{ m.icon }}</span> {{ m.label }}
          </RouterLink>
          <button class="module-menu__logout" @click="logout">Sair</button>
        </nav>
      </div>
    </Transition>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useNow } from '@/composables/useNow'
import { modulesFor } from '@/lib/modules'
import { roleLabels } from '@/lib/format'

defineProps<{ title: string }>()

const staff  = useStaffStore()
const tenant = useSettingsStore().tenant
const router = useRouter()
const now    = useNow(10_000)
const open   = ref(false)

const clock     = computed(() => new Date(now.value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
const available = computed(() => modulesFor(staff.role))

function logout() {
  staff.logout()
  router.push({ name: 'staff-login' })
}
</script>

<style lang="scss" scoped>
.staff-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  height: var(--topbar-height);
  padding: 0 var(--spacing-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);

  &__menu {
    @include button-reset;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    @include flex-center;
    &:hover { color: var(--color-text); }
  }

  &__title {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
    h1 { font-size: 1.0625rem; }
  }

  &__store {
    font-size: 0.625rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-accent-text);
    font-weight: 600;
  }

  &__slot { flex: 1; display: flex; justify-content: flex-end; gap: var(--spacing-sm); min-width: 0; }
  &__clock { font-family: var(--font-mono); color: var(--color-text-muted); }
}

.module-menu {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.5);

  &__panel {
    position: absolute;
    top: 8px;
    left: 8px;
    width: min(280px, calc(100% - 16px));
    padding: var(--spacing-sm);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
    border-bottom: 1px solid var(--color-border);
    strong, small { display: block; }
    small { color: var(--color-text-muted); font-size: 0.75rem; }
  }

  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    font-weight: 700;
    @include flex-center;
  }

  &__link {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 10px var(--spacing-sm);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-weight: 500;
    &:hover { background: var(--color-surface-alt); color: var(--color-text); }
    &.router-link-exact-active { background: var(--color-primary-soft); color: var(--color-accent-text); }
  }

  &__icon { width: 18px; text-align: center; }

  &__logout {
    @include button-reset;
    margin-top: var(--spacing-xs);
    padding: 10px var(--spacing-sm);
    border-top: 1px solid var(--color-border);
    text-align: left;
    color: var(--color-danger);
    font-weight: 500;
  }
}

.menu-enter-active, .menu-leave-active { transition: opacity 150ms ease; }
.menu-enter-from, .menu-leave-to { opacity: 0; }
</style>
