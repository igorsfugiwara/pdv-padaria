<template>
  <AppModal :model-value="!!session" :title="title" size="sm" @update:model-value="emit('close')">
    <div v-if="session && payment && nota" class="nfce">
      <p v-if="nota.ambiente !== 'producao'" class="nfce__env">
        {{ nota.ambiente === 'simulado' ? 'SIMULAÇÃO — SEM VALOR FISCAL' : 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL' }}
      </p>
      <p v-if="nota.status === 'cancelada'" class="nfce__env nfce__env--cancel">NFC-e CANCELADA</p>
      <p v-if="nota.status === 'contingencia'" class="nfce__env">EMITIDA EM CONTINGÊNCIA — pendente de autorização</p>

      <header class="nfce__head">
        <strong>{{ config.razaoSocial.toUpperCase() }}</strong>
        <span>CNPJ {{ config.cnpj }} · IE {{ config.inscricaoEstadual }}</span>
        <span>{{ config.endereco.logradouro }}, {{ config.endereco.numero }} · {{ config.endereco.municipio }}/{{ config.endereco.uf }}</span>
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
        <div v-if="payment.serviceFee && config.taxaServicoNaNota"><dt>Outras despesas R$</dt><dd>{{ money(payment.serviceFee) }}</dd></div>
        <div class="nfce__grand"><dt>Valor a pagar R$</dt><dd>{{ money(notaTotal) }}</dd></div>
        <template v-if="payment.parts">
          <div v-for="p in payment.parts" :key="p.method"><dt>{{ methodLabels[p.method] }}</dt><dd>{{ money(p.amount) }}</dd></div>
        </template>
        <div v-else><dt>{{ methodLabels[payment.method] }}</dt><dd>{{ money(payment.received ?? payment.total) }}</dd></div>
        <div v-if="payment.change"><dt>Troco R$</dt><dd>{{ money(payment.change) }}</dd></div>
      </dl>

      <p class="nfce__center">Consulte pela chave de acesso em<br />{{ nota.urlConsulta ?? 'www.nfce.fazenda.sp.gov.br/consulta' }}</p>
      <p class="nfce__key">{{ nota.chave ? formatKey(nota.chave) : '—' }}</p>
      <p class="nfce__center">{{ nota.cpf ? `CONSUMIDOR CPF ${formatCpf(nota.cpf)}` : 'CONSUMIDOR NÃO IDENTIFICADO' }}</p>
      <p class="nfce__center">
        NFC-e nº {{ String(nota.numero ?? 0).padStart(9, '0') }} · Série {{ String(nota.serie ?? config.serie).padStart(3, '0') }}<br />
        {{ new Date(nota.autorizadaEm ?? nota.criadaEm).toLocaleString('pt-BR') }}
      </p>
      <p v-if="nota.protocolo" class="nfce__center">Protocolo de autorização: {{ nota.protocolo }}</p>

      <img v-if="qr" :src="qr" alt="QR Code da NFC-e" class="nfce__qr" />
      <p class="nfce__center nfce__small">Comanda {{ session.number }} · Operador {{ nota.operador }}</p>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="emit('close')">Fechar</AppButton>
      <AppButton v-if="nota?.danfeUrl" variant="outline" @click="openDanfe">DANFE do provedor</AppButton>
      <AppButton @click="print">Imprimir</AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import QRCode from 'qrcode'
import type { ComandaSession, NfceDoc } from '@/types'
import { useOrderStore }    from '@/stores/useOrderStore'
import { useFiscalStore }   from '@/stores/useFiscalStore'
import { methodLabels } from '@/lib/format'
import { formatKey } from '@/lib/nfce'
import { formatCpf } from '@/fiscal/validate'
import AppModal  from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'

const props = defineProps<{ session: ComandaSession | null }>()
const emit  = defineEmits<{ close: [] }>()

const orders = useOrderStore()
const fiscal = useFiscalStore()
const config = computed(() => fiscal.config)

const payment = computed(() => props.session?.payment ?? null)

// Documento fiscal completo; notas antigas só têm o resumo no pagamento
const nota = computed<NfceDoc | null>(() => {
  const s = props.session
  const summary = s?.payment?.nfce
  if (!s || !summary) return null
  return fiscal.byId.get(summary.ref ?? s.id) ?? {
    id: s.id, comandaId: s.id, comandaNumber: s.number, status: summary.status ?? 'autorizada',
    provider: 'simulado', ambiente: summary.ambiente ?? 'simulado', total: s.payment!.total,
    numero: summary.number, serie: summary.series, chave: summary.key, criadaEm: summary.issuedAt,
    autorizadaEm: summary.issuedAt, tentativas: 1, operador: s.payment!.operator,
  }
})

const title = computed(() => {
  const n = nota.value
  if (!n) return 'NFC-e'
  return n.status === 'cancelada' ? 'NFC-e cancelada' : n.status === 'contingencia' ? 'NFC-e em contingência' : 'NFC-e emitida'
})

const items = computed(() =>
  props.session ? orders.byComanda(props.session.id).flatMap((o) => o.items).filter((i) => !i.cancelled) : []
)
const notaTotal = computed(() => {
  const p = payment.value
  if (!p) return 0
  return p.subtotal - p.discount + (config.value.taxaServicoNaNota ? p.serviceFee : 0)
})

const money = (c: number) => (c / 100).toFixed(2).replace('.', ',')

// QR real (URL da SEFAZ devolvida pelo provedor). Na simulação, só um texto.
const qr = ref('')
watch(nota, async (n) => {
  qr.value = ''
  if (!n?.chave) return
  const content = n.qrcodeUrl ?? `NFC-e simulada · chave ${n.chave}`
  qr.value = await QRCode.toDataURL(content, { margin: 1, width: 180, errorCorrectionLevel: 'M' })
}, { immediate: true })

function openDanfe() {
  if (nota.value?.danfeUrl) window.open(nota.value.danfeUrl, '_blank', 'noopener')
}

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
    &--cancel { border-style: solid; font-size: 0.875rem; }
  }

  &__head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px dashed #999;
    strong { font-size: 0.8125rem; }
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
  &__qr { align-self: center; width: 180px; height: 180px; image-rendering: pixelated; }
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
