<template>
  <div class="page">
    <!-- Caixa fechado -->
    <template v-if="!cashier.active">
      <header class="page__header">
        <div>
          <h1 class="page__title">Caixa</h1>
          <p class="page__subtitle">Abra o caixa para receber pagamentos e fechar comandas.</p>
        </div>
      </header>
      <section class="panel open-box">
        <div class="panel__body form-stack">
          <div class="field">
            <span class="field__label">Operador</span>
            <input v-model="operator" class="input" placeholder="Nome de quem está no caixa" />
          </div>
          <AppInput v-model="openingBalance" label="Fundo de troco" variant="money" />
          <AppButton size="lg" full-width :disabled="!operator.trim()" @click="open">Abrir caixa</AppButton>
        </div>
      </section>
    </template>

    <!-- Caixa aberto -->
    <template v-else>
      <header class="page__header">
        <div>
          <h1 class="page__title">Caixa aberto</h1>
          <p class="page__subtitle">
            {{ cashier.active.operator }} · desde {{ formatDateTime(cashier.active.openedAt) }} · fundo {{ formatMoney(cashier.active.openingBalance) }}
          </p>
        </div>
        <div class="page__actions">
          <AppButton variant="outline" @click="openMovement('suprimento')">+ Suprimento</AppButton>
          <AppButton variant="outline" @click="openMovement('sangria')">− Sangria</AppButton>
          <AppButton variant="danger" @click="showClose = true">Fechar caixa</AppButton>
        </div>
      </header>

      <div class="tiles">
        <StatTile label="Recebido nesta sessão" :value="formatMoney(summary.total)" :hint="plural(summary.count, 'comanda paga', 'comandas pagas')" hero />
        <StatTile label="Dinheiro esperado na gaveta" :value="formatMoney(summary.expectedCash)" hint="Fundo + dinheiro + suprimentos − sangrias" />
        <StatTile
          label="Comandas abertas"
          :value="String(comandas.openSessions.length)"
          :hint="comandas.openSessions.length ? 'Ainda por receber' : 'Nada pendente'"
          :hint-tone="comandas.openSessions.length ? 'warning' : 'success'"
        />
      </div>

      <div class="cashier-grid">
        <HBarList
          title="Por forma de pagamento"
          :rows="methodRows"
          :format="formatMoney"
        />

        <section class="panel">
          <div class="panel__head"><h3>Movimentações de gaveta</h3></div>
          <ul v-if="sessionMoves.length" class="moves">
            <li v-for="m in sessionMoves" :key="m.id" class="moves__row">
              <AppBadge :tone="m.type === 'sangria' ? 'danger' : 'success'">{{ m.type === 'sangria' ? 'Sangria' : 'Suprimento' }}</AppBadge>
              <div class="moves__info">
                <span>{{ m.reason }}</span>
                <small>{{ m.operator }} · {{ formatTime(m.createdAt) }}</small>
              </div>
              <span class="moves__amount money">{{ m.type === 'sangria' ? '−' : '+' }}{{ formatMoney(m.amount) }}</span>
            </li>
          </ul>
          <p v-else class="panel__empty">Nenhuma sangria ou suprimento nesta sessão.</p>
        </section>
      </div>

      <section class="panel">
        <div class="panel__head"><h3>Recebimentos</h3></div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Hora</th><th>Comanda</th><th>Forma</th><th>NFC-e</th><th class="num">Valor</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in paid" :key="c.id">
                <td data-label="Hora">{{ formatTime(c.payment!.paidAt) }}</td>
                <td data-label="Comanda">{{ comandaLabel(c.number) }}</td>
                <td data-label="Forma">{{ methodLabels[c.payment!.method] }}</td>
                <td data-label="NFC-e">{{ c.payment!.nfce ? `nº ${c.payment!.nfce.number}` : '—' }}</td>
                <td data-label="Valor" class="num">{{ formatMoney(c.payment!.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!paid.length" class="panel__empty">Nenhum pagamento ainda.</p>
      </section>
    </template>

    <section v-if="cashier.history.length" class="panel">
      <div class="panel__head"><h3>Sessões anteriores</h3></div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Abertura</th><th>Fechamento</th><th>Operador</th><th class="num">Recebido</th><th class="num">Diferença</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in cashier.history" :key="s.id">
              <td data-label="Abertura">{{ formatDateTime(s.openedAt) }}</td>
              <td data-label="Fechamento">{{ formatDateTime(s.closedAt!) }}</td>
              <td data-label="Operador">{{ s.operator }}</td>
              <td data-label="Recebido" class="num">{{ formatMoney(cashier.summary(s.id).total) }}</td>
              <td data-label="Diferença" :class="['num', diffClass(s.countedCash! - cashier.summary(s.id).expectedCash)]">
                {{ formatMoney(s.countedCash! - cashier.summary(s.id).expectedCash) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <!-- Sangria / suprimento -->
  <AppModal v-model="showMovement" :title="movementType === 'sangria' ? 'Sangria' : 'Suprimento'" size="sm">
    <div class="form-stack">
      <p class="text-muted">{{ movementType === 'sangria' ? 'Retirada de dinheiro da gaveta (depósito, pagamento de fornecedor…).' : 'Entrada de dinheiro na gaveta (troco extra).' }}</p>
      <AppInput v-model="movementAmount" label="Valor" variant="money" />
      <div class="field">
        <span class="field__label">Motivo</span>
        <input v-model="movementReason" class="input" placeholder="Obrigatório" />
      </div>
    </div>
    <template #footer>
      <AppButton variant="ghost" @click="showMovement = false">Cancelar</AppButton>
      <AppButton :disabled="!movementAmount || !movementReason.trim()" @click="saveMovement">Registrar</AppButton>
    </template>
  </AppModal>

  <!-- Fechar caixa -->
  <AppModal v-model="showClose" title="Fechar caixa">
    <div class="form-stack">
      <div v-if="comandas.openSessions.length" class="alert alert--warning">
        {{ comandas.openSessions.length }} comandas continuam abertas. Elas passam para o próximo caixa.
      </div>
      <div class="close-rows">
        <div><span>Fundo de troco</span><span class="money">{{ formatMoney(cashier.active?.openingBalance ?? 0) }}</span></div>
        <div><span>Vendas em dinheiro</span><span class="money">{{ formatMoney(summary.cashSales) }}</span></div>
        <div v-if="summary.suprimentos"><span>Suprimentos</span><span class="money">+{{ formatMoney(summary.suprimentos) }}</span></div>
        <div v-if="summary.sangrias"><span>Sangrias</span><span class="money">−{{ formatMoney(summary.sangrias) }}</span></div>
        <div class="close-rows__total"><span>Dinheiro esperado</span><span class="money">{{ formatMoney(summary.expectedCash) }}</span></div>
      </div>
      <AppInput v-model="counted" label="Dinheiro contado na gaveta" variant="money" />
      <p v-if="counted > 0" :class="['close-diff', diffClass(counted - summary.expectedCash)]">
        {{ counted === summary.expectedCash ? 'Caixa confere ✓' : counted > summary.expectedCash ? `Sobra de ${formatMoney(counted - summary.expectedCash)}` : `Falta de ${formatMoney(summary.expectedCash - counted)}` }}
      </p>
      <div class="field">
        <span class="field__label">Observações</span>
        <textarea v-model="closeNotes" class="textarea" rows="2" placeholder="Opcional" />
      </div>
    </div>
    <template #footer>
      <AppButton variant="ghost" @click="showClose = false">Cancelar</AppButton>
      <AppButton variant="danger" :disabled="counted <= 0" @click="close">Confirmar fechamento</AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CashMovement } from '@/types'
import { useCashierStore }  from '@/stores/useCashierStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useToastStore }    from '@/stores/useToastStore'
import { formatMoney, formatTime, formatDateTime, methodLabels, comandaLabel, plural } from '@/lib/format'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput  from '@/components/ui/AppInput.vue'
import AppModal  from '@/components/ui/AppModal.vue'
import AppBadge  from '@/components/ui/AppBadge.vue'
import StatTile  from '@/components/ui/StatTile.vue'
import HBarList  from '@/components/charts/HBarList.vue'

const cashier  = useCashierStore()
const comandas = useComandasStore()
const staff    = useStaffStore()
const toast    = useToastStore()

// --- Abertura ---
const operator       = ref(staff.user?.name ?? '')
const openingBalance = ref(20000)

function open() {
  cashier.open(operator.value.trim(), openingBalance.value)
  toast.add('Caixa aberto.', 'success')
}

// --- Sessão ativa ---
const summary = computed(() => (cashier.active ? cashier.summary(cashier.active.id) : cashier.summary('')))
const paid    = computed(() =>
  cashier.active
    ? cashier.paidComandas(cashier.active.id).sort((a, b) => b.payment!.paidAt.localeCompare(a.payment!.paidAt))
    : []
)
const sessionMoves = computed(() => cashier.movements.filter((m) => m.sessionId === cashier.active?.id))

const methodRows = computed(() =>
  (Object.entries(summary.value.byMethod) as [keyof typeof methodLabels, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => ({ key: m, label: methodLabels[m], value: v }))
)

// --- Movimentações ---
const showMovement   = ref(false)
const movementType   = ref<CashMovement['type']>('sangria')
const movementAmount = ref(0)
const movementReason = ref('')

function openMovement(type: CashMovement['type']) {
  movementType.value   = type
  movementAmount.value = 0
  movementReason.value = ''
  showMovement.value   = true
}

function saveMovement() {
  cashier.addMovement(movementType.value, movementAmount.value, movementReason.value, staff.user?.name ?? 'Caixa')
  showMovement.value = false
  toast.add(`${movementType.value === 'sangria' ? 'Sangria' : 'Suprimento'} de ${formatMoney(movementAmount.value)} registrado.`, 'success')
}

// --- Fechamento ---
const showClose  = ref(false)
const counted    = ref(0)
const closeNotes = ref('')

function close() {
  cashier.close(counted.value, closeNotes.value)
  showClose.value = false
  counted.value = 0
  closeNotes.value = ''
  toast.add('Caixa fechado.', 'success')
}

function diffClass(diff: number): string {
  return diff === 0 ? 'is-ok' : diff > 0 ? 'is-warn' : 'is-bad'
}
</script>

<style lang="scss" scoped>
.open-box { max-width: 420px; }
.text-muted { color: var(--color-text-muted); font-size: 0.875rem; }

.cashier-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  align-items: start;
  @media (max-width: 1023px) { grid-template-columns: 1fr; }
}

.moves__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  &:last-child { border-bottom: none; }
}

.moves__info { flex: 1; display: flex; flex-direction: column; font-size: 0.875rem; small { color: var(--color-text-muted); font-size: 0.75rem; } }
.moves__amount { font-size: 0.875rem; }

.close-rows {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9375rem;
  > div { display: flex; justify-content: space-between; }
  &__total { font-weight: 600; padding-top: 6px; border-top: 1px solid var(--color-border); }
}

.close-diff { font-weight: 600; font-size: 0.9375rem; }
.is-ok   { color: var(--color-success); }
.is-warn { color: var(--color-warning); }
.is-bad  { color: var(--color-danger); }
</style>
