<template>
  <AppModal :model-value="!!session" :title="session ? `Fechar conta · ${comandaLabel(session.number)}` : ''" size="md" @update:model-value="emit('close')">
    <div v-if="session" class="payment">
      <div v-if="!cashier.active" class="alert alert--danger">
        <span>O caixa está fechado. Abra o caixa para receber pagamentos.</span>
        <RouterLink :to="{ name: 'admin-caixa' }" class="payment__link" @click="emit('close')">Abrir caixa →</RouterLink>
      </div>

      <div v-if="pending.length" class="alert alert--warning">
        {{ pending.length }} {{ pending.length === 1 ? 'pedido ainda não foi entregue' : 'pedidos ainda não foram entregues' }}.
        Confira com o salão antes de fechar.
      </div>

      <!-- Resumo -->
      <div class="payment__rows">
        <div class="payment__row"><span>Subtotal</span><span class="money">{{ formatMoney(subtotal) }}</span></div>
        <div v-if="discount" class="payment__row payment__row--discount"><span>Desconto</span><span class="money">−{{ formatMoney(discount) }}</span></div>
        <div v-if="serviceFee" class="payment__row payment__row--muted"><span>Taxa de serviço ({{ servicePercent }}%)</span><span class="money">{{ formatMoney(serviceFee) }}</span></div>
        <div class="payment__row payment__row--total"><span>Total</span><span class="money payment__value">{{ formatMoney(total) }}</span></div>
      </div>

      <!-- Ajustes -->
      <div class="payment__adjust">
        <div class="field">
          <span class="field__label">Desconto</span>
          <div class="payment__discount">
            <div class="segmented">
              <button :class="['segmented__btn', { 'segmented__btn--active': discountMode === 'valor' }]" @click="discountMode = 'valor'">R$</button>
              <button :class="['segmented__btn', { 'segmented__btn--active': discountMode === 'percent' }]" @click="discountMode = 'percent'">%</button>
            </div>
            <AppInput v-if="discountMode === 'valor'" v-model="discountValue" variant="money" aria-label="Desconto em reais" />
            <input v-else v-model.number="discountPercent" class="input" type="number" min="0" max="100" aria-label="Desconto em porcentagem" />
          </div>
        </div>
        <label class="toggle">
          <button type="button" :class="['switch', { 'switch--on': serviceOn }]" role="switch" :aria-checked="serviceOn" @click="serviceOn = !serviceOn" />
          <span>Taxa de serviço {{ servicePercent }}%</span>
        </label>
      </div>

      <!-- Forma de pagamento -->
      <div class="payment__methods">
        <button
          v-for="m in methodList"
          :key="m"
          :class="['method-btn', { 'method-btn--active': method === m }]"
          @click="method = m"
        >{{ methodLabels[m] }}</button>
      </div>

      <template v-if="method === 'dinheiro'">
        <AppInput v-model="received" label="Valor recebido" variant="money" />
        <div class="quick-cash">
          <button v-for="v in quickCash" :key="v" class="chip" @click="received = v">{{ formatMoney(v) }}</button>
        </div>
        <div v-if="received > 0" class="payment__row">
          <span>Troco</span>
          <span :class="['money', { 'text-danger': change < 0 }]">{{ formatMoney(Math.max(change, 0)) }}</span>
        </div>
        <p v-if="received > 0 && change < 0" class="payment__insufficient">Faltam {{ formatMoney(-change) }}</p>
      </template>

      <template v-if="method === 'misto'">
        <div class="mixed">
          <div v-for="(part, idx) in parts" :key="idx" class="mixed__row">
            <select v-model="part.method" class="select mixed__select">
              <option v-for="m in simpleMethods" :key="m" :value="m">{{ methodLabels[m] }}</option>
            </select>
            <AppInput v-model="part.amount" variant="money" aria-label="Valor da parcela" />
            <button v-if="parts.length > 1" type="button" class="mixed__remove" aria-label="Remover parcela" @click="parts.splice(idx, 1)">✕</button>
          </div>
          <button type="button" class="mixed__add" @click="parts.push({ method: 'credito', amount: Math.max(mixedRemaining, 0) })">+ Parcela</button>
          <p :class="['mixed__status', mixedRemaining === 0 ? 'mixed__status--ok' : 'mixed__status--err']">
            {{ mixedRemaining === 0 ? '✓ Valores conferem' : mixedRemaining > 0 ? `Faltam ${formatMoney(mixedRemaining)}` : `Excesso de ${formatMoney(-mixedRemaining)}` }}
          </p>
        </div>
      </template>

      <label class="toggle">
        <button type="button" :class="['switch', { 'switch--on': emitNfce }]" role="switch" :aria-checked="emitNfce" @click="emitNfce = !emitNfce" />
        <span>Emitir NFC-e <small>(simulada)</small></span>
      </label>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="emit('close')">Cancelar</AppButton>
      <AppButton variant="success" :loading="paying" :disabled="!canConfirm" @click="confirm">
        Confirmar {{ formatMoney(total) }}
      </AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ComandaSession, Payment, PaymentMethod, SimpleMethod } from '@/types'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useCashierStore }  from '@/stores/useCashierStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useStaffStore }    from '@/stores/useStaffStore'
import { formatMoney, methodLabels, comandaLabel } from '@/lib/format'
import { buildNfceKey } from '@/lib/nfce'
import AppModal  from '@/components/ui/AppModal.vue'
import AppInput  from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'

const props = defineProps<{ session: ComandaSession | null }>()
const emit  = defineEmits<{ close: []; paid: [session: ComandaSession] }>()

const orders   = useOrderStore()
const comandas = useComandasStore()
const cashier  = useCashierStore()
const staff    = useStaffStore()
const settingsStore = useSettingsStore()

const simpleMethods: SimpleMethod[] = ['pix', 'credito', 'debito', 'dinheiro', 'voucher']
const methodList: PaymentMethod[]   = [...simpleMethods, 'misto']

const method          = ref<PaymentMethod>('pix')
const discountMode    = ref<'valor' | 'percent'>('valor')
const discountValue   = ref(0)
const discountPercent = ref(0)
const serviceOn       = ref(false)
const received        = ref(0)
const parts           = ref<{ method: SimpleMethod; amount: number }[]>([])
const emitNfce        = ref(true)
const paying          = ref(false)

const servicePercent = computed(() => settingsStore.settings.serviceFeePercent || 10)

// Cada abertura começa do zero
watch(() => props.session?.id, (id) => {
  if (!id) return
  method.value = 'pix'
  discountMode.value = 'valor'
  discountValue.value = 0
  discountPercent.value = 0
  serviceOn.value = settingsStore.settings.serviceFeePercent > 0
  received.value = 0
  parts.value = [{ method: 'pix', amount: 0 }, { method: 'credito', amount: 0 }]
  emitNfce.value = true
})

const subtotal   = computed(() => (props.session ? orders.comandaSubtotal(props.session.id) : 0))
const pending    = computed(() => (props.session ? orders.pendingInComanda(props.session.id) : []))
const discount   = computed(() => {
  const d = discountMode.value === 'valor'
    ? discountValue.value
    : Math.round(subtotal.value * Math.min(Math.max(discountPercent.value || 0, 0), 100) / 100)
  return Math.min(d, subtotal.value)
})
const serviceFee = computed(() => (serviceOn.value ? Math.round((subtotal.value - discount.value) * servicePercent.value / 100) : 0))
const total      = computed(() => subtotal.value - discount.value + serviceFee.value)
const change     = computed(() => received.value - total.value)
const mixedRemaining = computed(() => total.value - parts.value.reduce((s, p) => s + p.amount, 0))

// Notas mais prováveis para agilizar o troco
const quickCash = computed(() => {
  const t = total.value
  const opts = [Math.ceil(t / 1000) * 1000, Math.ceil(t / 2000) * 2000, Math.ceil(t / 5000) * 5000, Math.ceil(t / 10000) * 10000]
  return [...new Set(opts)].filter((v) => v >= t).slice(0, 4)
})

const canConfirm = computed(() => {
  if (!cashier.active || total.value <= 0) return false
  if (method.value === 'dinheiro') return change.value >= 0 && received.value > 0
  if (method.value === 'misto') return mixedRemaining.value === 0 && parts.value.every((p) => p.amount > 0)
  return true
})

async function confirm() {
  if (!props.session || !canConfirm.value || !cashier.active) return
  paying.value = true
  await new Promise((r) => setTimeout(r, 300))    // simula autorização da maquininha / SEFAZ
  const now = new Date()
  const payment: Payment = {
    subtotal:   subtotal.value,
    discount:   discount.value,
    serviceFee: serviceFee.value,
    total:      total.value,
    method:     method.value,
    paidAt:     now.toISOString(),
    operator:   staff.user?.name ?? 'Caixa',
    cashierSessionId: cashier.active.id,
  }
  if (method.value === 'dinheiro') {
    payment.received = received.value
    payment.change   = change.value
  }
  if (method.value === 'misto') payment.parts = parts.value.map((p) => ({ ...p }))
  if (emitNfce.value) {
    const number = await comandas.nextNfceNumber()
    const series = settingsStore.settings.nfceSeries
    payment.nfce = { number, series, key: buildNfceKey(settingsStore.tenant.cnpj, series, number, now), issuedAt: payment.paidAt }
  }
  await comandas.close(props.session.id, payment)
  paying.value = false
  emit('paid', comandas.byId.get(props.session.id)!)
}
</script>

<style lang="scss" scoped>
.payment {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  &__link { margin-left: auto; color: var(--color-accent-text); font-weight: 500; white-space: nowrap; }

  &__rows {
    background: var(--color-surface-alt);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9375rem;
    &--muted    { color: var(--color-text-muted); }
    &--discount { color: var(--color-success); }
    &--total    { font-weight: 600; padding-top: 6px; border-top: 1px solid var(--color-border); margin-top: 2px; }
  }

  &__value { font-size: 1.375rem; color: var(--color-accent-text); }

  &__adjust {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: var(--spacing-md);
    @media (max-width: 479px) { grid-template-columns: 1fr; }
  }

  &__discount {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
    :deep(.field) { flex: 1; }
    .input { flex: 1; }
  }

  &__methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-sm); }
  &__insufficient { font-size: 0.875rem; color: var(--color-danger); }
}

.text-danger { color: var(--color-danger); }

.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.9375rem;
  cursor: pointer;
  min-height: 40px;
  small { color: var(--color-text-muted); }
}

.method-btn {
  height: 44px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  &:hover   { border-color: var(--color-primary); color: var(--color-text); }
  &--active { background: var(--color-primary-soft); border-color: var(--color-primary); color: var(--color-accent-text); }
}

.quick-cash { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

.mixed {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  &__row { display: flex; align-items: center; gap: var(--spacing-sm); :deep(.field) { flex: 1; } }
  &__select { width: 150px; flex-shrink: 0; }

  &__remove {
    flex-shrink: 0;
    width: 36px;
    height: 40px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    &:hover { border-color: var(--color-danger); color: var(--color-danger); }
  }

  &__add {
    align-self: flex-start;
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.8125rem;
    padding: 6px 12px;
    &:hover { border-color: var(--color-primary); color: var(--color-accent-text); }
  }

  &__status {
    font-size: 0.875rem;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--color-surface-alt);
    text-align: center;
    &--ok  { color: var(--color-success); }
    &--err { color: var(--color-danger); }
  }
}
</style>
