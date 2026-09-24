<template>
  <AppModal :model-value="!!session" title="NFC-e emitida" size="sm" @update:model-value="emit('close')">
    <div v-if="session && payment" class="nfce">
      <p class="nfce__env">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL</p>

      <header class="nfce__head">
        <strong>{{ tenant.name.toUpperCase() }}</strong>
        <span>CNPJ {{ tenant.cnpj }}</span>
        <span>{{ tenant.city }}</span>
        <span class="nfce__doc">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</span>
      </header>

      <table class="nfce__items">
        <thead>
          <tr><th>Descrição</th><th class="r">Qtd</th><th class="r">Vl. unit</th><th class="r">Total</th></tr>
        </thead>
        <tbody>
          <tr v-for="i in items" :key="i.id">
            <td>{{ i.productName }}<template v-if="i.choices.length"> ({{ i.choices.map((c) => c.name).join(', ') }})</template></td>
            <td class="r">{{ i.quantity }}</td>
            <td class="r">{{ money(i.unitPrice) }}</td>
            <td class="r">{{ money(i.unitPrice * i.quantity) }}</td>
          </tr>
        </tbody>
      </table>

      <dl class="nfce__totals">
        <div><dt>Qtde. total de itens</dt><dd>{{ items.reduce((s, i) => s + i.quantity, 0) }}</dd></div>
        <div><dt>Valor total R$</dt><dd>{{ money(payment.subtotal) }}</dd></div>
        <div v-if="payment.discount"><dt>Desconto R$</dt><dd>−{{ money(payment.discount) }}</dd></div>
        <div v-if="payment.serviceFee"><dt>Taxa de serviço R$</dt><dd>{{ money(payment.serviceFee) }}</dd></div>
        <div class="nfce__grand"><dt>Valor a pagar R$</dt><dd>{{ money(payment.total) }}</dd></div>
        <template v-if="payment.parts">
          <div v-for="p in payment.parts" :key="p.method"><dt>{{ methodLabels[p.method] }}</dt><dd>{{ money(p.amount) }}</dd></div>
        </template>
        <div v-else><dt>{{ methodLabels[payment.method] }}</dt><dd>{{ money(payment.received ?? payment.total) }}</dd></div>
        <div v-if="payment.change"><dt>Troco R$</dt><dd>{{ money(payment.change) }}</dd></div>
      </dl>

      <p class="nfce__center">Consulte pela chave de acesso em www.nfce.fazenda.sp.gov.br/consulta</p>
      <p class="nfce__key">{{ formatKey(payment.nfce!.key) }}</p>
      <p class="nfce__center">CONSUMIDOR NÃO IDENTIFICADO</p>
      <p class="nfce__center">
        NFC-e nº {{ String(payment.nfce!.number).padStart(9, '0') }} · Série {{ String(payment.nfce!.series).padStart(3, '0') }}<br />
        {{ new Date(payment.nfce!.issuedAt).toLocaleString('pt-BR') }}
      </p>

      <!-- QR ilustrativo, derivado da chave -->
      <div class="nfce__qr" aria-hidden="true">
        <span v-for="(on, i) in qrCells" :key="i" :class="{ on }" />
      </div>
      <p class="nfce__center nfce__small">Comanda {{ session.number }} · Operador {{ payment.operator }}</p>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="emit('close')">Fechar</AppButton>
      <AppButton @click="print">Imprimir</AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComandaSession } from '@/types'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { methodLabels } from '@/lib/format'
import { formatKey } from '@/lib/nfce'
import { hashString, createRandom } from '@/lib/random'
import AppModal  from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'

const props = defineProps<{ session: ComandaSession | null }>()
const emit  = defineEmits<{ close: [] }>()

const orders = useOrderStore()
const tenant = useSettingsStore().tenant

const payment = computed(() => props.session?.payment ?? null)
const items   = computed(() =>
  props.session ? orders.byComanda(props.session.id).flatMap((o) => o.items).filter((i) => !i.cancelled) : []
)

const money = (c: number) => (c / 100).toFixed(2).replace('.', ',')

const qrCells = computed(() => {
  const rnd = createRandom(hashString(payment.value?.nfce?.key ?? 'x'))
  return Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21, y = Math.floor(i / 21)
    const finder = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
      const lx = x % 7 === x ? x : x - 14, ly = y < 7 ? y : y - 14
      const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6
      const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4
      return ring || core
    }
    return rnd.chance(0.5)
  })
})

function print() {
  window.print()
}
</script>

<style lang="scss" scoped>
// O cupom é sempre papel branco, independente do tema da equipe
.nfce {
  background: #fff;
  color: #111;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.45;
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  &__env {
    text-align: center;
    font-weight: 700;
    padding: 4px;
    border: 1px dashed #111;
  }

  &__head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px dashed #999;
    strong { font-size: 0.875rem; }
  }

  &__doc { margin-top: 4px; font-size: 0.6875rem; }

  &__items {
    width: 100%;
    th { font-weight: 700; text-align: left; border-bottom: 1px dashed #999; padding: 2px 0; }
    td { padding: 2px 0; vertical-align: top; }
    .r { text-align: right; padding-left: 6px; white-space: nowrap; }
  }

  &__totals {
    border-top: 1px dashed #999;
    padding-top: var(--spacing-sm);
    div { display: flex; justify-content: space-between; }
    dd { font-variant-numeric: tabular-nums; }
  }

  &__grand { font-weight: 700; font-size: 0.8125rem; }
  &__center { text-align: center; }
  &__small { font-size: 0.6875rem; color: #555; }
  &__key { text-align: center; font-weight: 700; word-spacing: 2px; }

  &__qr {
    align-self: center;
    display: grid;
    grid-template-columns: repeat(21, 4px);
    gap: 0;
    padding: 6px;
    background: #fff;
    span { width: 4px; height: 4px; }
    span.on { background: #111; }
  }
}
</style>

<style lang="scss">
// Impressão: só o cupom sai no papel
@media print {
  body * { visibility: hidden; }
  .nfce, .nfce * { visibility: visible; }
  .nfce { position: absolute; left: 0; top: 0; width: 80mm; }
}
</style>
