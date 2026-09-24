<template>
  <div class="login">
    <header class="login__brand">
      <span class="login__logo" aria-hidden="true">{{ tenant.logoEmoji }}</span>
      <h1 class="login__name">{{ tenant.name }}</h1>
      <p class="login__tag">Acesso da equipe</p>
    </header>

    <!-- 1. Quem é você -->
    <section v-if="!selected" class="login__card">
      <h2>Quem está entrando?</h2>
      <div class="profiles">
        <button v-for="u in staff.users" :key="u.id" class="profile" @click="select(u.id)">
          <span class="profile__avatar">{{ u.name.charAt(0) }}</span>
          <span class="profile__name">{{ u.name }}</span>
          <span class="profile__role">{{ roleLabels[u.role] }}</span>
        </button>
      </div>
    </section>

    <!-- 2. PIN -->
    <section v-else class="login__card">
      <button class="login__back" @click="reset">← Trocar de perfil</button>
      <div class="pin-head">
        <span class="profile__avatar profile__avatar--lg">{{ selected.name.charAt(0) }}</span>
        <h2>{{ selected.name }}</h2>
        <p>{{ roleLabels[selected.role] }} · digite seu PIN</p>
      </div>

      <div :class="['pin-dots', { 'pin-dots--error': error }]" aria-live="polite" :aria-label="`${pin.length} de 4 dígitos`">
        <span v-for="i in 4" :key="i" :class="['pin-dots__dot', { 'pin-dots__dot--on': pin.length >= i }]" />
      </div>
      <p v-if="error" class="pin-error">PIN incorreto. Tente de novo.</p>

      <div class="keypad">
        <button v-for="k in ['1','2','3','4','5','6','7','8','9']" :key="k" class="keypad__key" @click="press(k)">{{ k }}</button>
        <span />
        <button class="keypad__key" @click="press('0')">0</button>
        <button class="keypad__key keypad__key--muted" aria-label="Apagar" @click="pin = pin.slice(0, -1)">⌫</button>
      </div>
    </section>

    <p class="login__demo">
      Demonstração · PINs: Cozinha 1111 · Salão 2222 · Caixa 3333 · Gerência 0000
    </p>
    <RouterLink :to="{ name: 'scan' }" class="login__customer">Ir para o app do cliente</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useStaffStore, homeRoute } from '@/stores/useStaffStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { roleLabels } from '@/lib/format'

const staff  = useStaffStore()
const tenant = useSettingsStore().tenant
const router = useRouter()

const selectedId = ref<string | null>(null)
const pin        = ref('')
const error      = ref(false)
const selected   = computed(() => staff.users.find((u) => u.id === selectedId.value) ?? null)

function select(id: string) {
  selectedId.value = id
  pin.value = ''
  error.value = false
}

function reset() {
  selectedId.value = null
  pin.value = ''
}

function press(k: string) {
  if (pin.value.length >= 4) return
  error.value = false
  pin.value += k
  if (pin.value.length === 4) submit()
}

function submit() {
  if (!selected.value) return
  if (staff.login(selected.value.id, pin.value)) {
    const redirect = router.currentRoute.value.query.redirect
    router.replace(typeof redirect === 'string' ? redirect : { name: homeRoute[selected.value.role] })
  } else {
    error.value = true
    navigator.vibrate?.([40, 60, 40])
    setTimeout(() => { pin.value = '' }, 350)
  }
}

// Teclado físico também digita o PIN (tablet com teclado, desktop)
function onKey(e: KeyboardEvent) {
  if (!selected.value) return
  if (/^\d$/.test(e.key)) press(e.key)
  else if (e.key === 'Backspace') pin.value = pin.value.slice(0, -1)
  else if (e.key === 'Escape') reset()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style lang="scss" scoped>
.login {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl) var(--spacing-md);

  &__brand { display: flex; flex-direction: column; align-items: center; text-align: center; }

  &__logo {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 1px solid var(--color-primary);
    font-size: 1.5rem;
    @include flex-center;
    margin-bottom: var(--spacing-sm);
  }

  &__name { font-family: var(--font-display); font-size: 2rem; line-height: 1; }
  &__tag  { margin-top: 6px; font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-accent-text); }

  &__card {
    width: 100%;
    max-width: 440px;
    @include card;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    h2 { font-size: 1.125rem; }
  }

  &__back {
    @include button-reset;
    align-self: flex-start;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    &:hover { color: var(--color-text); }
  }

  &__demo { font-size: 0.75rem; color: var(--color-text-muted); text-align: center; max-width: 440px; }
  &__customer { font-size: 0.8125rem; color: var(--color-text-muted); text-decoration: underline; text-underline-offset: 3px; }
}

.profiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.profile {
  @include button-reset;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface-alt);
  transition: border-color var(--transition);

  &:hover { border-color: var(--color-primary); }

  &__avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-primary-soft);
    border: 1px solid var(--color-primary);
    color: var(--color-accent-text);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    @include flex-center;
    margin-bottom: 4px;

    &--lg { width: 60px; height: 60px; font-size: 1.625rem; }
  }

  &__name { font-weight: 600; }
  &__role { font-size: 0.75rem; color: var(--color-text-muted); }
}

.pin-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  p { font-size: 0.875rem; color: var(--color-text-muted); }
}

.pin-dots {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);

  &--error { animation: shake 300ms ease; }

  &__dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    transition: all var(--transition);
    &--on { background: var(--color-primary); border-color: var(--color-primary); }
  }
}

.pin-error { text-align: center; font-size: 0.8125rem; color: var(--color-danger); }

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);

  &__key {
    @include button-reset;
    height: 60px;
    border-radius: var(--radius-lg);
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 1.375rem;
    transition: background var(--transition);
    &:active { background: var(--color-primary-soft); }
    &--muted { color: var(--color-text-muted); }
  }
}

@keyframes shake {
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
</style>
