<template>
  <div class="scan">
    <header class="brand">
      <span class="brand__logo" aria-hidden="true">{{ tenant.logoEmoji }}</span>
      <h1 class="brand__name">{{ tenant.name }}</h1>
      <p class="brand__tag">{{ tenant.tagline }}</p>
      <span class="brand__rule" aria-hidden="true" />
    </header>

    <div v-if="closedNotice" class="notice" role="status">
      <strong>Conta encerrada. Obrigado pela visita!</strong>
      <span>Volte sempre. Para pedir de novo, registre outra comanda.</span>
    </div>

    <section class="scan__intro">
      <p class="eyebrow">Autoatendimento</p>
      <h2>Registre sua comanda</h2>
      <p>Aponte a câmera para o código da comanda que você recebeu na entrada.</p>
    </section>

    <!-- Visor da câmera -->
    <div :class="['viewfinder', `viewfinder--${state}`]">
      <video ref="video" class="viewfinder__video" playsinline muted />

      <div v-if="state === 'scanning' || state === 'paused'" class="viewfinder__frame" aria-hidden="true">
        <span class="viewfinder__laser" />
      </div>

      <div v-if="state === 'idle'" class="viewfinder__placeholder">
        <div class="comanda-illus" aria-hidden="true">
          <span class="comanda-illus__title">{{ tenant.name.toUpperCase() }}</span>
          <span class="comanda-illus__bars" />
          <span class="comanda-illus__num">042</span>
        </div>
        <AppButton size="xl" variant="ink" @click="start">Abrir câmera</AppButton>
      </div>

      <div v-else-if="state === 'starting'" class="viewfinder__placeholder">
        <span class="spinner" />
        <p>Abrindo a câmera…</p>
      </div>

      <div v-else-if="blocked" class="viewfinder__placeholder viewfinder__placeholder--error">
        <span class="viewfinder__error-icon" aria-hidden="true">📷</span>
        <p>{{ blockedMessage }}</p>
        <AppButton v-if="state !== 'insecure'" variant="outline" @click="start">Tentar de novo</AppButton>
      </div>

      <p v-if="state === 'scanning'" class="viewfinder__hint">Centralize o código na moldura</p>
      <button v-if="state === 'scanning' || state === 'paused'" class="viewfinder__close" aria-label="Fechar câmera" @click="stop()">✕</button>
    </div>

    <p v-if="error" class="scan__error" role="alert">{{ error }}</p>

    <div class="scan__divider"><span>ou</span></div>

    <form class="manual" @submit.prevent="submitManual">
      <label class="manual__label" for="comanda-num">Digite o número impresso na comanda</label>
      <div class="manual__row">
        <input
          id="comanda-num"
          v-model="manual"
          class="manual__input"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="4"
          autocomplete="off"
          placeholder="000"
        />
        <AppButton type="submit" size="xl" :disabled="!manual.trim()">Entrar</AppButton>
      </div>
    </form>

    <footer class="scan__footer">
      <button class="link" @click="enter(DEMO_COMANDA)">Validar layout com a comanda de teste {{ DEMO_COMANDA }}</button>
      <RouterLink :to="{ name: 'staff-login' }" class="link link--muted">Acesso da equipe</RouterLink>
    </footer>
  </div>

  <!-- Boas-vindas: nome opcional -->
  <AppSheet :model-value="welcome" @update:model-value="(v) => !v && goToMenu()">
    <div class="welcome">
      <span class="welcome__check" aria-hidden="true">✓</span>
      <p class="eyebrow">Comanda {{ customer.session?.number }} registrada</p>
      <h2 class="welcome__title">Seja bem-vindo ao {{ tenant.name }}</h2>
      <label class="field">
        <span class="field__label">Como podemos te chamar? (opcional)</span>
        <input
          v-model="name"
          class="input welcome__input"
          maxlength="30"
          placeholder="Seu primeiro nome"
          autocomplete="given-name"
          @keydown.enter="goToMenu"
        />
      </label>
      <p class="welcome__hint">Ajuda a equipe a te encontrar na hora de entregar.</p>
    </div>
    <template #footer>
      <AppButton size="xl" variant="ink" full-width @click="goToMenu">Ver cardápio</AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useComandaScanner } from '@/composables/useComandaScanner'
import AppButton from '@/components/ui/AppButton.vue'
import AppSheet  from '@/components/ui/AppSheet.vue'

const DEMO_COMANDA = '042'

const customer = useCustomerStore()
const tenant   = useSettingsStore().tenant
const route    = useRoute()
const router   = useRouter()

const manual  = ref('')
const error   = ref('')
const welcome = ref(false)
const name    = ref('')
const closedNotice = computed(() => route.query.encerrada === '1')

const { video, state, start, stop, resume } = useComandaScanner((raw) => {
  // Código lido mas inválido: mostra o motivo e volta a ler em seguida
  if (!enter(raw)) setTimeout(resume, 1800)
})

const blocked = computed(() => ['denied', 'no-camera', 'insecure', 'error'].includes(state.value))

const blockedMessage = computed(() => ({
  denied:      'Sem permissão para usar a câmera. Libere o acesso nas configurações do navegador ou digite o número abaixo.',
  'no-camera': 'Não encontramos uma câmera neste aparelho. Digite o número abaixo.',
  insecure:    'A câmera só funciona em conexão segura (https). Digite o número abaixo.',
  error:       'Não foi possível abrir a câmera. Tente de novo ou digite o número abaixo.',
} as Record<string, string>)[state.value] ?? '')

function enter(raw: string): boolean {
  const result = customer.activate(raw)
  if (!result.ok) {
    error.value = result.reason
    navigator.vibrate?.([40, 60, 40])
    return false
  }
  error.value = ''
  stop()
  name.value    = customer.session?.customerName ?? ''
  welcome.value = true
  return true
}

function submitManual() {
  if (manual.value.trim()) enter(manual.value)
}

function goToMenu() {
  if (name.value.trim()) customer.setName(name.value)
  welcome.value = false
  router.replace({ name: 'menu' })
}

// QR impresso na comanda aponta para /<loja>?c=0042: abre já registrado,
// sem precisar da câmera dentro do app
onMounted(() => {
  const c = route.query.c
  if (typeof c === 'string' && c) enter(c)
})
</script>

<style lang="scss" scoped>
.scan {
  min-height: 100dvh;
  padding: var(--spacing-xl) var(--spacing-md) calc(var(--spacing-lg) + var(--safe-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);

  &__intro {
    text-align: center;
    h2 { font-family: var(--font-display); font-size: 1.5rem; margin: 4px 0; }
    p:last-child { color: var(--color-text-muted); font-size: 0.9375rem; }
  }

  &__error {
    margin-top: calc(-1 * var(--spacing-sm));
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-danger-soft);
    color: var(--color-danger);
    font-size: 0.9375rem;
    font-weight: 500;
  }

  &__divider {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    &::before, &::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
  }

  &__footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
  }
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  &__logo {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 1px solid var(--color-primary);
    background: var(--color-surface);
    box-shadow: 0 0 0 5px var(--color-bg), 0 0 0 6px var(--color-border);
    font-size: 1.875rem;
    @include flex-center;
    margin-bottom: var(--spacing-md);
  }

  &__name { font-family: var(--font-display); font-size: 2.25rem; line-height: 1; letter-spacing: 0.01em; }
  &__tag  { margin-top: 6px; font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-text-muted); }
  &__rule { width: 48px; height: 1px; background: var(--color-primary); margin-top: var(--spacing-md); }
}

.notice {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-primary);
  text-align: center;
  font-size: 0.875rem;
  span { color: var(--color-text-muted); }
}

.viewfinder {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #17130E;
  color: #F0EDE6;

  &--idle, &--denied, &--no-camera, &--insecure, &--error {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
  }

  &__video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  &--idle &__video, &--starting &__video { visibility: hidden; }

  &__frame {
    position: absolute;
    inset: 22% 10%;
    border-radius: var(--radius-lg);
    box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.45);
    border: 2px solid var(--color-primary);
    overflow: hidden;
  }

  &--paused &__frame { border-color: var(--color-success); }

  &__laser {
    position: absolute;
    left: 6%;
    right: 6%;
    height: 2px;
    background: var(--color-primary);
    box-shadow: 0 0 10px var(--color-primary);
    animation: laser 1.6s ease-in-out infinite alternate;
  }

  &--paused &__laser { display: none; }

  &__placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    text-align: center;

    &--error p { color: var(--color-text-muted); font-size: 0.9375rem; }
  }

  &__error-icon { font-size: 2rem; filter: grayscale(1); opacity: 0.6; }

  &__hint {
    position: absolute;
    left: 0;
    right: 0;
    bottom: var(--spacing-md);
    text-align: center;
    font-size: 0.875rem;
    font-weight: 500;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }

  &__close {
    @include button-reset;
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    @include flex-center;
  }
}

@keyframes laser { from { top: 12%; } to { top: 86%; } }

.comanda-illus {
  width: 150px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: #FFFDF8;
  border: 1px solid var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: rotate(-4deg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #1E1A15;

  &__title { font-family: var(--font-display); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.24em; }
  &__bars {
    width: 100%;
    height: 34px;
    background: repeating-linear-gradient(90deg,
      #1E1A15 0 2px, transparent 2px 4px, #1E1A15 4px 5px, transparent 5px 8px,
      #1E1A15 8px 11px, transparent 11px 12px);
  }
  &__num { font-family: var(--font-mono); font-size: 1.125rem; font-weight: 500; }
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.manual {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  &__label { font-size: 0.9375rem; font-weight: 500; }
  &__row   { display: flex; gap: var(--spacing-sm); }

  &__input {
    flex: 1;
    min-width: 0;
    height: 56px;
    padding: 0 var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 1.5rem;
    letter-spacing: 0.2em;
    text-align: center;
    &:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
  }
}

.link {
  @include button-reset;
  font-size: 0.875rem;
  color: var(--color-accent-text);
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
  text-underline-offset: 3px;

  &--muted { color: var(--color-text-muted); text-decoration-color: var(--color-border); }
}

.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);

  &__check {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    font-size: 1.375rem;
    font-weight: 700;
    @include flex-center;
    margin-bottom: var(--spacing-xs);
  }

  &__title { font-family: var(--font-display); font-size: 1.5rem; margin-bottom: var(--spacing-md); }
  .field { width: 100%; text-align: left; }
  &__input { background: var(--color-surface); height: 48px; }
  &__hint { font-size: 0.8125rem; color: var(--color-text-muted); }
}
</style>
