<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">Configurações</h1>
        <p class="page__subtitle">{{ tenant.name }} · as alterações valem na hora para todas as telas</p>
      </div>
    </header>

    <div class="settings">
      <section class="panel">
        <div class="panel__head"><h3>Estabelecimento</h3></div>
        <div class="panel__body">
          <dl class="info">
            <div><dt>Nome</dt><dd>{{ tenant.name }}</dd></div>
            <div><dt>Descrição</dt><dd>{{ tenant.tagline }}</dd></div>
            <div><dt>CNPJ</dt><dd>{{ tenant.cnpj }}</dd></div>
            <div><dt>Cidade</dt><dd>{{ tenant.city }}</dd></div>
          </dl>
          <div class="field link-field">
            <span class="field__label">Link do cliente (vai no QR da comanda, com o número no final)</span>
            <code class="code">{{ customerUrl }}?c=0042</code>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h3>Aparência da equipe</h3></div>
        <div class="panel__body form-stack">
          <p class="muted">O app do cliente é sempre claro e dourado. Cozinha, salão e administrativo podem usar:</p>
          <div class="theme-options">
            <button :class="['theme-opt', 'theme-opt--dark', { 'theme-opt--on': s.staffTheme === 'escuro' }]" @click="update({ staffTheme: 'escuro' })">
              <span class="theme-opt__swatch" /> Escuro dourado
            </button>
            <button :class="['theme-opt', 'theme-opt--light', { 'theme-opt--on': s.staffTheme === 'claro' }]" @click="update({ staffTheme: 'claro' })">
              <span class="theme-opt__swatch" /> Claro dourado
            </button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h3>Tempos da cozinha e do salão</h3></div>
        <div class="panel__body form-stack">
          <p class="muted">Controlam a cor dos cards: verde até o primeiro limite, laranja até o segundo, vermelho depois.</p>
          <div class="form-grid">
            <div class="field">
              <span class="field__label">Atenção a partir de (min)</span>
              <input class="input" type="number" min="1" :value="s.warnMinutes" @change="numberSetting('warnMinutes', $event)" />
            </div>
            <div class="field">
              <span class="field__label">Atrasado a partir de (min)</span>
              <input class="input" type="number" min="2" :value="s.lateMinutes" @change="numberSetting('lateMinutes', $event)" />
            </div>
          </div>
          <div class="preview">
            <span class="preview__item preview__item--ok">0–{{ s.warnMinutes - 1 }} min</span>
            <span class="preview__item preview__item--warn">{{ s.warnMinutes }}–{{ s.lateMinutes - 1 }} min</span>
            <span class="preview__item preview__item--late">{{ s.lateMinutes }}+ min</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h3>Salão e conta</h3></div>
        <div class="panel__body form-grid">
          <div class="field">
            <span class="field__label">Número de mesas</span>
            <input class="input" type="number" min="1" max="99" :value="s.tables" @change="numberSetting('tables', $event)" />
          </div>
          <div class="field">
            <span class="field__label">Taxa de serviço padrão (%)</span>
            <input class="input" type="number" min="0" max="20" :value="s.serviceFeePercent" @change="numberSetting('serviceFeePercent', $event)" />
            <span class="field__hint">0 = desligada no fechamento (o caixa ainda pode aplicar 10%)</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h3>Comandas físicas</h3></div>
        <div class="panel__body form-stack">
          <div class="form-grid">
            <div class="field">
              <span class="field__label">Primeira comanda</span>
              <input class="input" type="number" min="1" :value="s.comandaMin" @change="numberSetting('comandaMin', $event)" />
            </div>
            <div class="field">
              <span class="field__label">Última comanda</span>
              <input class="input" type="number" min="1" :value="s.comandaMax" @change="numberSetting('comandaMax', $event)" />
            </div>
          </div>
          <div class="field">
            <span class="field__label">Comandas bloqueadas (perdidas ou danificadas)</span>
            <div class="blocked">
              <span v-for="n in s.blockedComandas" :key="n" class="blocked__chip">
                {{ n }} <button :aria-label="`Desbloquear ${n}`" @click="unblock(n)">✕</button>
              </span>
              <form class="blocked__add" @submit.prevent="block">
                <input v-model="newBlocked" class="input" inputmode="numeric" placeholder="Nº" maxlength="4" />
                <AppButton size="sm" variant="outline" type="submit" :disabled="!newBlocked">Bloquear</AppButton>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h3>NFC-e</h3><AppBadge tone="warning">Simulada</AppBadge></div>
        <div class="panel__body form-grid">
          <div class="field">
            <span class="field__label">Série</span>
            <input class="input" type="number" min="1" :value="s.nfceSeries" @change="numberSetting('nfceSeries', $event)" />
          </div>
          <div class="field">
            <span class="field__label">Ambiente</span>
            <input class="input" value="Homologação (sem valor fiscal)" disabled />
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h3>Equipe</h3></div>
        <table class="data-table">
          <thead><tr><th>Nome</th><th>Perfil</th><th>PIN</th><th></th></tr></thead>
          <tbody>
            <tr v-for="u in staff.users" :key="u.id">
              <td data-label="Nome">{{ u.name }}</td>
              <td data-label="Perfil">{{ roleLabels[u.role] }}</td>
              <td data-label="PIN" class="num">{{ pinOf(u.pin) }}</td>
              <td class="actions">
                <button v-if="u.id !== staff.user?.id" class="ghost-btn" @click="staff.removeUser(u.id)">Remover</button>
              </td>
            </tr>
          </tbody>
        </table>
        <form class="panel__body new-user" @submit.prevent="addUser">
          <input v-model="newUser.name" class="input" placeholder="Nome" />
          <select v-model="newUser.role" class="select">
            <option v-for="(label, key) in roleLabels" :key="key" :value="key">{{ label }}</option>
          </select>
          <input v-model="newUser.pin" class="input" inputmode="numeric" maxlength="4" placeholder="PIN (4 dígitos)" />
          <AppButton type="submit" variant="outline" :disabled="!newUser.name.trim() || !/^\d{4}$/.test(newUser.pin)">Adicionar</AppButton>
        </form>
      </section>

      <section class="panel panel--danger">
        <div class="panel__head"><h3>Dados de demonstração</h3></div>
        <div class="panel__body form-stack">
          <p class="muted">Apaga pedidos, comandas, caixa, estoque e alterações de cardápio desta loja e recria o dia de exemplo. Útil para validar o fluxo do zero.</p>
          <AppButton variant="danger" @click="showReset = true">Recriar dados de exemplo</AppButton>
        </div>
      </section>
    </div>
  </div>

  <AppConfirm
    v-model="showReset"
    title="Recriar dados de exemplo"
    message="Todos os dados de teste desta loja serão apagados em todas as abas abertas. Continuar?"
    confirm-label="Apagar e recriar"
    @confirm="reset"
    @cancel="showReset = false"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Role, Settings } from '@/types'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useToastStore }    from '@/stores/useToastStore'
import { resetTenantData } from '@/db/seed'
import { firebaseEnabled } from '@/firebase'
import { parseComandaCode } from '@/lib/comanda'
import { roleLabels } from '@/lib/format'
import AppButton  from '@/components/ui/AppButton.vue'
import AppBadge   from '@/components/ui/AppBadge.vue'
import AppConfirm from '@/components/ui/AppConfirm.vue'

const settingsStore = useSettingsStore()
const staff  = useStaffStore()
const toast  = useToastStore()
const tenant = settingsStore.tenant
const s      = computed(() => settingsStore.settings)

const customerUrl = `${window.location.origin}/${tenant.slug}`

function update(patch: Partial<Settings>) {
  settingsStore.update(patch)
    .then(() => toast.add('Configuração salva.', 'success'))
    .catch(() => toast.add('Não foi possível salvar a configuração.', 'error'))
}

type NumericKey = 'warnMinutes' | 'lateMinutes' | 'tables' | 'serviceFeePercent' | 'comandaMin' | 'comandaMax' | 'nfceSeries'

function numberSetting(key: NumericKey, e: Event) {
  const v = Math.round(Number((e.target as HTMLInputElement).value))
  if (!Number.isFinite(v) || v < 0) return
  const patch: Partial<Settings> = { [key]: v }
  // atrasado precisa ser depois de atenção
  if (key === 'warnMinutes' && v >= s.value.lateMinutes) patch.lateMinutes = v + 1
  if (key === 'lateMinutes' && v <= s.value.warnMinutes) patch.warnMinutes = Math.max(1, v - 1)
  update(patch)
}

// --- Comandas bloqueadas ---
const newBlocked = ref('')

function block() {
  const n = parseComandaCode(newBlocked.value)
  if (!n || s.value.blockedComandas.includes(n)) return
  update({ blockedComandas: [...s.value.blockedComandas, n].sort() })
  newBlocked.value = ''
}

function unblock(n: string) {
  update({ blockedComandas: s.value.blockedComandas.filter((x) => x !== n) })
}

// --- Equipe ---
const newUser = ref<{ name: string; role: Role; pin: string }>({ name: '', role: 'salao', pin: '' })

function addUser() {
  staff.addUser(newUser.value.name.trim(), newUser.value.role, newUser.value.pin)
  toast.add(`${newUser.value.name} adicionado à equipe.`, 'success')
  newUser.value = { name: '', role: 'salao', pin: '' }
}

const showReset = ref(false)

async function reset() {
  showReset.value = false
  toast.add('Recriando os dados de exemplo…', 'info')
  try {
    await resetTenantData()
  } catch (err) {
    console.error(err)
    toast.add('Não foi possível recriar os dados. Veja o console.', 'error')
  }
}

// No Firestore o PIN não volta para o navegador (fica em staffPins, ilegível)
const pinOf = (pin?: string) => (firebaseEnabled || !pin ? '••••' : pin)
</script>

<style lang="scss" scoped>
.settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  align-items: start;
  @media (max-width: 1023px) { grid-template-columns: 1fr; }
}

.muted { color: var(--color-text-muted); font-size: 0.875rem; }

.info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  dt { font-size: 0.75rem; color: var(--color-text-muted); }
  dd { font-weight: 500; }
}

.link-field { margin-top: var(--spacing-md); }

.code {
  display: block;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-accent-text);
}

.theme-options { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); }

.theme-opt {
  @include button-reset;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-weight: 500;

  &--on { border-color: var(--color-primary); box-shadow: inset 0 0 0 1px var(--color-primary); }

  &__swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
  }

  &--dark &__swatch  { background: linear-gradient(135deg, #0F0F0F 50%, #E8C547 50%); }
  &--light &__swatch { background: linear-gradient(135deg, #FAF7F1 50%, #C9A24A 50%); }
}

.preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);

  &__item {
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid;
    &--ok   { background: var(--color-success-soft); border-color: var(--color-success); }
    &--warn { background: var(--color-warning-soft); border-color: var(--color-warning); }
    &--late { background: var(--color-danger-soft);  border-color: var(--color-danger); }
  }
}

.blocked {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px 4px 12px;
    border-radius: 99px;
    background: var(--color-danger-soft);
    font-family: var(--font-mono);
    font-size: 0.875rem;
    button { @include button-reset; padding: 2px 6px; color: var(--color-text-muted); &:hover { color: var(--color-danger); } }
  }

  &__add { display: flex; gap: var(--spacing-sm); .input { width: 80px; } }
}

.new-user {
  display: grid;
  grid-template-columns: 1fr 130px 130px auto;
  gap: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  @media (max-width: 599px) { grid-template-columns: 1fr 1fr; }
}

.actions { text-align: right; }

.ghost-btn {
  @include button-reset;
  font-size: 0.8125rem;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  &:hover { color: var(--color-danger); background: var(--color-danger-soft); }
}

.panel--danger { border-color: var(--color-danger-soft); }
</style>
