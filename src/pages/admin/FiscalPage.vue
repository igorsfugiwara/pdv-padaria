<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">Fiscal · NFC-e</h1>
        <p class="page__subtitle">Notas das vendas, dados do emitente e tributação dos produtos</p>
      </div>
      <div class="page__actions">
        <AppBadge :tone="modeTone">{{ modeLabel }}</AppBadge>
        <AppButton v-if="fiscal.isReal" variant="outline" size="sm" :loading="checking" @click="checkServer">Verificar servidor</AppButton>
      </div>
    </header>

    <!-- O que falta para emitir de verdade -->
    <section v-if="!ready || !fiscal.isReal" class="panel">
      <div class="panel__head">
        <h3>{{ fiscal.isReal ? 'Pendências para emitir' : 'Para sair do modo simulado' }}</h3>
        <span class="muted">Passo a passo completo em docs/FISCAL.md</span>
      </div>
      <ul class="checklist">
        <li :class="['check', { 'check--ok': !r.emitente.length }]">
          <XMark :ok="!r.emitente.length" />
          <div>
            <strong>Dados do emitente</strong>
            <span>{{ r.emitente.length ? r.emitente.join(' · ') : 'Completos' }}</span>
          </div>
          <button class="link" @click="tab = 'emitente'">Abrir</button>
        </li>
        <li :class="['check', { 'check--ok': !r.produtosIncompletos.length }]">
          <XMark :ok="!r.produtosIncompletos.length" />
          <div>
            <strong>Tributação dos produtos</strong>
            <span>
              {{ r.totalProdutos - r.produtosIncompletos.length }} de {{ r.totalProdutos }} completos
              <template v-if="r.produtosNaoRevisados.length"> · {{ r.produtosNaoRevisados.length }} ainda não conferidos pelo contador</template>
            </span>
          </div>
          <button class="link" @click="tab = 'produtos'">Abrir</button>
        </li>
        <li :class="['check', { 'check--ok': serverOk === true }]">
          <XMark :ok="serverOk === true" />
          <div>
            <strong>Provedor fiscal e token no servidor</strong>
            <span>{{ serverText }}</span>
          </div>
        </li>
        <li class="check check--info">
          <XMark :ok="null" />
          <div>
            <strong>Certificado A1, credenciamento na SEFAZ e CSC</strong>
            <span>Ficam na conta do provedor (Focus NFe), nunca neste app. Sem eles a SEFAZ recusa a nota.</span>
          </div>
        </li>
      </ul>
    </section>

    <div class="segmented" role="tablist">
      <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'notas' }]" @click="tab = 'notas'">Notas<template v-if="fiscal.attention"> ({{ fiscal.attention }})</template></button>
      <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'emitente' }]" @click="tab = 'emitente'">Emitente</button>
      <button :class="['segmented__btn', { 'segmented__btn--active': tab === 'produtos' }]" @click="tab = 'produtos'">Produtos</button>
    </div>

    <!-- ── Notas ── -->
    <template v-if="tab === 'notas'">
      <div class="chips">
        <button v-for="f in filters" :key="f.value" :class="['chip', { 'chip--active': filter === f.value }]" @click="filter = f.value">
          {{ f.label }}<template v-if="f.value !== 'todas'"> · {{ fiscal.count(f.value) }}</template>
        </button>
      </div>
      <section class="panel">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Emissão</th><th>Comanda</th><th>Número</th><th>Situação</th><th>Ambiente</th><th class="num">Valor</th></tr>
            </thead>
            <tbody>
              <tr v-for="d in rows" :key="d.id" class="is-clickable" @click="openId = d.id">
                <td data-label="Emissão">{{ formatDateTime(d.criadaEm) }}</td>
                <td data-label="Comanda">{{ d.comandaNumber }}</td>
                <td data-label="Número" class="num">{{ d.numero ? `${d.numero} / ${d.serie}` : '—' }}</td>
                <td data-label="Situação">
                  <AppBadge :tone="statusTone[d.status]">{{ statusLabels[d.status] }}</AppBadge>
                  <small v-if="d.status === 'rejeitada' && d.mensagem" class="row-msg">{{ d.mensagem }}</small>
                </td>
                <td data-label="Ambiente">{{ ambienteLabels[d.ambiente] }}</td>
                <td data-label="Valor" class="num">{{ formatMoney(d.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!rows.length" class="panel__empty">Nenhuma nota nesta situação nos últimos 7 dias.</p>
      </section>
    </template>

    <!-- ── Emitente ── -->
    <section v-else-if="tab === 'emitente'" class="panel">
      <div class="panel__head">
        <h3>Emitente e emissão</h3>
        <span v-if="!staff.isAdmin" class="muted">Só a gerência altera</span>
      </div>
      <fieldset class="panel__body form-stack" :disabled="!staff.isAdmin">
        <div class="form-grid">
          <div class="field span-2">
            <span class="field__label">Modo de emissão</span>
            <select v-model="mode" class="select">
              <option value="simulado">Simulado · sem valor fiscal</option>
              <option value="focusnfe:homologacao">Focus NFe · Homologação (testes na SEFAZ, sem valor fiscal)</option>
              <option value="focusnfe:producao">Focus NFe · Produção (nota com valor fiscal)</option>
            </select>
          </div>
          <div class="field span-2"><span class="field__label">Razão social</span><input v-model="draft.razaoSocial" class="input" /></div>
          <div class="field"><span class="field__label">Nome fantasia</span><input v-model="draft.nomeFantasia" class="input" /></div>
          <div class="field"><span class="field__label">CNPJ</span><input v-model="draft.cnpj" class="input" inputmode="numeric" /></div>
          <div class="field"><span class="field__label">Inscrição estadual</span><input v-model="draft.inscricaoEstadual" class="input" /></div>
          <div class="field">
            <span class="field__label">Regime tributário</span>
            <select v-model.number="draft.crt" class="select">
              <option :value="1">1 · Simples Nacional (CSOSN)</option>
              <option :value="3">3 · Regime normal (CST)</option>
            </select>
          </div>
          <div class="field span-2"><span class="field__label">Logradouro</span><input v-model="draft.endereco.logradouro" class="input" /></div>
          <div class="field"><span class="field__label">Número</span><input v-model="draft.endereco.numero" class="input" /></div>
          <div class="field"><span class="field__label">Bairro</span><input v-model="draft.endereco.bairro" class="input" /></div>
          <div class="field"><span class="field__label">Município</span><input v-model="draft.endereco.municipio" class="input" /></div>
          <div class="field"><span class="field__label">Código IBGE do município</span><input v-model="draft.endereco.codigoMunicipio" class="input" inputmode="numeric" maxlength="7" /></div>
          <div class="field"><span class="field__label">UF</span><input v-model="draft.endereco.uf" class="input" maxlength="2" @input="draft.endereco.uf = draft.endereco.uf.toUpperCase()" /></div>
          <div class="field"><span class="field__label">CEP</span><input v-model="draft.endereco.cep" class="input" inputmode="numeric" /></div>
          <div class="field"><span class="field__label">Série da NFC-e</span><input v-model.number="draft.serie" class="input" type="number" min="1" max="999" /></div>
          <div class="field"><span class="field__label">Prazo de cancelamento (min)</span><input v-model.number="draft.cancelamentoMinutos" class="input" type="number" min="1" /></div>
          <div class="field"><span class="field__label">Prazo de contingência (h)</span><input v-model.number="draft.contingenciaHoras" class="input" type="number" min="1" /></div>
          <div class="field span-2"><span class="field__label">Informações adicionais no cupom</span><input v-model="draft.informacoesAdicionais" class="input" maxlength="200" /></div>
        </div>
        <label class="toggle">
          <button type="button" :class="['switch', { 'switch--on': draft.taxaServicoNaNota }]" role="switch" :aria-checked="draft.taxaServicoNaNota" @click="draft.taxaServicoNaNota = !draft.taxaServicoNaNota" />
          Taxa de serviço entra na nota (outras despesas)
        </label>
        <div v-if="draftIssues.length" class="alert alert--warning">{{ draftIssues.join(' · ') }}</div>
        <div class="actions">
          <AppButton variant="ghost" @click="resetDraft">Descartar</AppButton>
          <AppButton :disabled="!staff.isAdmin || !dirty" :loading="saving" @click="saveConfig">Salvar</AppButton>
        </div>
      </fieldset>
    </section>

    <!-- ── Produtos ── -->
    <section v-else class="panel">
      <div class="panel__head">
        <h3>Tributação dos produtos</h3>
        <span class="muted">Quem define NCM, CFOP e {{ fiscal.config.crt === 1 ? 'CSOSN' : 'CST' }} é o contador</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Produto</th><th>NCM</th><th>CFOP</th><th>{{ fiscal.config.crt === 1 ? 'CSOSN' : 'CST' }}</th><th>Situação</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in catalog.activeProducts" :key="p.id" class="is-clickable" @click="editing = p">
              <td data-label="Produto">{{ p.emoji }} {{ p.name }}</td>
              <td data-label="NCM" class="num">{{ p.fiscal?.ncm || '—' }}</td>
              <td data-label="CFOP" class="num">{{ p.fiscal?.cfop || '—' }}</td>
              <td data-label="Tributação" class="num">{{ (fiscal.config.crt === 1 ? p.fiscal?.csosn : p.fiscal?.cstIcms) || '—' }}</td>
              <td data-label="Situação">
                <AppBadge v-if="productFiscalIssues(p.fiscal, fiscal.config.crt).length" tone="danger">{{ productFiscalIssues(p.fiscal, fiscal.config.crt)[0] }}</AppBadge>
                <AppBadge v-else-if="!p.fiscal?.revisado" tone="warning">A revisar</AppBadge>
                <AppBadge v-else tone="success">Conferido</AppBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <!-- Detalhe da nota -->
  <AppDrawer
    :model-value="!!open"
    :title="open ? `NFC-e · Comanda ${open.comandaNumber}` : ''"
    :subtitle="open ? `${statusLabels[open.status]} · ${ambienteLabels[open.ambiente]}` : ''"
    @update:model-value="openId = null"
  >
    <template v-if="open">
      <dl class="facts">
        <div><dt>Situação</dt><dd><AppBadge :tone="statusTone[open.status]">{{ statusLabels[open.status] }}</AppBadge></dd></div>
        <div><dt>Número / série</dt><dd>{{ open.numero ? `${open.numero} / ${open.serie}` : '—' }}</dd></div>
        <div><dt>Valor</dt><dd>{{ formatMoney(open.total) }}</dd></div>
        <div><dt>Emitida</dt><dd>{{ formatDateTime(open.criadaEm) }} · {{ open.operador }}</dd></div>
        <div v-if="open.autorizadaEm"><dt>Autorizada</dt><dd>{{ formatDateTime(open.autorizadaEm) }}</dd></div>
        <div v-if="open.protocolo"><dt>Protocolo</dt><dd>{{ open.protocolo }}</dd></div>
        <div v-if="open.cpf"><dt>CPF na nota</dt><dd>{{ formatCpf(open.cpf) }}</dd></div>
        <div v-if="open.chave" class="facts__wide"><dt>Chave de acesso</dt><dd class="mono">{{ formatKey(open.chave) }}</dd></div>
        <div v-if="open.mensagem" class="facts__wide"><dt>Retorno</dt><dd>{{ open.codigoSefaz ? `${open.codigoSefaz} · ` : '' }}{{ open.mensagem }}</dd></div>
        <div v-if="open.cancelamento" class="facts__wide"><dt>Cancelamento</dt><dd>{{ formatDateTime(open.cancelamento.em) }} por {{ open.cancelamento.por }}: “{{ open.cancelamento.justificativa }}”</dd></div>
        <div v-if="open.status === 'contingencia'" class="facts__wide"><dt>Prazo da contingência</dt><dd>Transmitir até {{ formatDateTime(fiscal.contingencyDeadline(open).toISOString()) }}</dd></div>
      </dl>

      <div class="links">
        <a v-if="open.danfeUrl" :href="open.danfeUrl" target="_blank" rel="noopener">DANFE do provedor ↗</a>
        <a v-if="open.xmlUrl" :href="open.xmlUrl" target="_blank" rel="noopener">XML ↗</a>
        <a v-if="open.urlConsulta" :href="open.urlConsulta" target="_blank" rel="noopener">Consulta na SEFAZ ↗</a>
      </div>

      <section v-if="open.status === 'autorizada'" class="cancel">
        <h3>Cancelar a nota</h3>
        <template v-if="fiscal.canCancel(open, now)">
          <p class="muted">Pode cancelar até {{ formatTime(fiscal.cancelDeadline(open)!.toISOString()) }} ({{ fiscal.config.cancelamentoMinutos }} min da autorização). O pagamento da comanda não é desfeito.</p>
          <textarea v-model="justificativa" class="textarea" rows="3" maxlength="255" placeholder="Motivo do cancelamento (mínimo 15 caracteres)" />
          <p :class="['counter', { 'counter--ok': justificativa.trim().length >= 15 }]">{{ justificativa.trim().length }}/15</p>
        </template>
        <p v-else class="muted">Prazo de {{ fiscal.config.cancelamentoMinutos }} minutos encerrado: a correção agora é com o contador (nota de devolução ou ajuste).</p>
      </section>
    </template>

    <template v-if="open" #footer>
      <AppButton v-if="sessionOf(open)" variant="ghost" @click="receiptFor = sessionOf(open)">Ver cupom</AppButton>
      <AppButton v-if="open.status === 'pendente' || open.status === 'contingencia'" variant="outline" :loading="busy" :disabled="open.ambiente === 'simulado'" @click="run(() => fiscal.consultar(open!.id))">Consultar</AppButton>
      <AppButton v-if="open.status === 'rejeitada' || open.status === 'pendente'" :loading="busy" :disabled="!sessionOf(open)" @click="run(() => fiscal.reenviar(open!.id))">Reenviar</AppButton>
      <AppButton v-if="open.status === 'autorizada' && fiscal.canCancel(open, now)" variant="danger" :loading="busy" :disabled="justificativa.trim().length < 15" @click="cancel">Cancelar NFC-e</AppButton>
    </template>
  </AppDrawer>

  <NfceReceipt :session="receiptFor" @close="receiptFor = null" />
  <ProductEditor :product="editing" @close="editing = undefined" />
  <AppConfirm
    v-model="confirmProd"
    title="Emitir em produção"
    message="Em produção, cada venda gera uma NFC-e com valor fiscal na SEFAZ. Confirme que a homologação foi aprovada e que o contador conferiu a tributação dos produtos."
    confirm-label="Ligar produção"
    variant="danger"
    @confirm="saveConfig(true)"
    @cancel="confirmProd = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, defineComponent, h } from 'vue'
import type { ComandaSession, FiscalConfig, NfceStatus, Product } from '@/types'
import { useFiscalStore, type ServerStatus } from '@/stores/useFiscalStore'
import { useComandasStore } from '@/stores/useComandasStore'
import { useCatalogStore }  from '@/stores/useCatalogStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useStaffStore }    from '@/stores/useStaffStore'
import { useToastStore }    from '@/stores/useToastStore'
import { useNow } from '@/composables/useNow'
import { ambienteLabels, statusLabels } from '@/fiscal/codes'
import { configIssues, formatCpf, productFiscalIssues } from '@/fiscal/validate'
import { formatKey } from '@/lib/nfce'
import { formatMoney, formatDateTime, formatTime } from '@/lib/format'
import AppButton     from '@/components/ui/AppButton.vue'
import AppBadge      from '@/components/ui/AppBadge.vue'
import AppDrawer     from '@/components/ui/AppDrawer.vue'
import AppConfirm    from '@/components/ui/AppConfirm.vue'
import NfceReceipt   from '@/components/admin/NfceReceipt.vue'
import ProductEditor from '@/components/admin/ProductEditor.vue'

// Marca ✓ / ! / i do checklist
const XMark = defineComponent({
  props: { ok: { type: [Boolean, null], default: null } },
  setup: (p) => () => h('span', { class: ['xmark', p.ok === true ? 'xmark--ok' : p.ok === false ? 'xmark--no' : 'xmark--info'], 'aria-hidden': 'true' },
    p.ok === true ? '✓' : p.ok === false ? '!' : 'i'),
})

const fiscal   = useFiscalStore()
const comandas = useComandasStore()
const catalog  = useCatalogStore()
const settings = useSettingsStore()
const staff    = useStaffStore()
const toast    = useToastStore()
const now      = useNow(15_000)

const tab = ref<'notas' | 'emitente' | 'produtos'>('notas')
const r   = computed(() => fiscal.readiness)

const modeLabel = computed(() => (fiscal.isReal ? `Focus NFe · ${ambienteLabels[fiscal.config.ambiente]}` : 'Modo simulado'))
const modeTone  = computed(() => (fiscal.config.ambiente === 'producao' ? 'success' : fiscal.isReal ? 'warning' : 'muted'))

// ── Servidor ──
const serverStatus = ref<ServerStatus | null>(null)
const serverError  = ref('')
const checking     = ref(false)
const serverOk     = computed<boolean | null>(() => {
  if (!fiscal.isReal) return false
  if (!serverStatus.value) return null
  return !!serverStatus.value.tokens[fiscal.config.ambiente as 'homologacao' | 'producao']
})
const serverText = computed(() => {
  if (!fiscal.isReal) return 'Escolha a Focus NFe na aba Emitente e cadastre o token da loja no Netlify'
  if (serverError.value) return serverError.value
  if (!serverStatus.value) return 'Clique em "Verificar servidor"'
  return serverOk.value ? `Token de ${ambienteLabels[fiscal.config.ambiente]} configurado` : `Falta o token de ${ambienteLabels[fiscal.config.ambiente]} no Netlify`
})
const ready = computed(() => !r.value.emitente.length && !r.value.produtosIncompletos.length && serverOk.value === true)

async function checkServer() {
  checking.value = true
  serverError.value = ''
  try { serverStatus.value = await fiscal.serverStatus() } catch (e) { serverError.value = (e as Error).message }
  checking.value = false
}

// ── Notas ──
type Filter = NfceStatus | 'todas'
const filters: { value: Filter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'autorizada', label: 'Autorizadas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'rejeitada', label: 'Rejeitadas' },
  { value: 'contingencia', label: 'Contingência' },
  { value: 'cancelada', label: 'Canceladas' },
]
const filter = ref<Filter>('todas')
const rows   = computed(() => fiscal.docs.filter((d) => filter.value === 'todas' || d.status === filter.value))

const statusTone: Record<NfceStatus, 'gold' | 'success' | 'warning' | 'danger' | 'muted'> = {
  autorizada: 'success', pendente: 'warning', rejeitada: 'danger', contingencia: 'warning', cancelada: 'muted',
}

const openId = ref<string | null>(null)
const open   = computed(() => (openId.value ? fiscal.byId.get(openId.value) ?? null : null))
const justificativa = ref('')
const busy = ref(false)
const receiptFor = ref<ComandaSession | null>(null)
watch(openId, () => { justificativa.value = '' })

const sessionOf = (d: { comandaId: string }) => comandas.byId.get(d.comandaId) ?? null

async function run(fn: () => Promise<unknown>) {
  busy.value = true
  try { await fn() } catch (e) { toast.add((e as Error).message, 'error') }
  busy.value = false
}

async function cancel() {
  if (!open.value) return
  busy.value = true
  try {
    const res = await fiscal.cancelar(open.value.id, justificativa.value)
    toast.add(res.ok ? 'NFC-e cancelada.' : res.mensagem ?? 'Não foi possível cancelar', res.ok ? 'success' : 'error')
  } catch (e) {
    toast.add((e as Error).message, 'error')
  }
  busy.value = false
}

// ── Emitente ──
const clone = (c: FiscalConfig): FiscalConfig => JSON.parse(JSON.stringify(c))
const draft = ref<FiscalConfig>(clone(fiscal.config))
const saving = ref(false)
const confirmProd = ref(false)
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(fiscal.config))
const draftIssues = computed(() => (draft.value.provider === 'simulado' ? [] : configIssues(draft.value)))
watch(() => fiscal.config, () => { if (!dirty.value) resetDraft() }, { deep: true })

const mode = computed({
  get: () => (draft.value.provider === 'simulado' ? 'simulado' : `${draft.value.provider}:${draft.value.ambiente}`),
  set: (v: string) => {
    if (v === 'simulado') { draft.value.provider = 'simulado'; draft.value.ambiente = 'simulado'; return }
    const [p, a] = v.split(':')
    draft.value.provider = p as FiscalConfig['provider']
    draft.value.ambiente = a as FiscalConfig['ambiente']
  },
})

function resetDraft() { draft.value = clone(fiscal.config) }

async function saveConfig(confirmed = false) {
  confirmProd.value = false
  if (draft.value.ambiente === 'producao' && fiscal.config.ambiente !== 'producao' && !confirmed) {
    confirmProd.value = true
    return
  }
  saving.value = true
  try {
    await settings.update({ fiscal: clone(draft.value) })
    toast.add('Dados fiscais salvos.', 'success')
  } catch {
    toast.add('Não foi possível salvar.', 'error')
  }
  saving.value = false
}

// ── Produtos ──
const editing = ref<Product | null | undefined>(undefined)
</script>

<style lang="scss" scoped>
.muted { color: var(--color-text-muted); font-size: 0.8125rem; }

.checklist { display: flex; flex-direction: column; }

.check {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  &:last-child { border-bottom: none; }

  div { flex: 1; display: flex; flex-direction: column; font-size: 0.875rem; }
  span { color: var(--color-text-muted); }
}

:deep(.xmark) {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
}
:deep(.xmark--ok)   { background: var(--color-success-soft); color: var(--color-success); }
:deep(.xmark--no)   { background: var(--color-warning-soft); color: var(--color-warning); }
:deep(.xmark--info) { background: var(--color-surface-alt); color: var(--color-text-muted); }

.link {
  @include button-reset;
  font-size: 0.8125rem;
  color: var(--color-accent-text);
  &:hover { text-decoration: underline; }
}

.chips { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

.row-msg { display: block; margin-top: 4px; font-size: 0.75rem; color: var(--color-danger); max-width: 360px; }

fieldset { border: none; min-width: 0; }
fieldset:disabled { opacity: 0.8; }

.toggle { display: inline-flex; align-items: center; gap: var(--spacing-sm); font-size: 0.9375rem; }
.actions { display: flex; justify-content: flex-end; gap: var(--spacing-sm); }

.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  dt { font-size: 0.75rem; color: var(--color-text-muted); }
  dd { font-size: 0.9375rem; }
  &__wide { grid-column: 1 / -1; }
}

.mono { font-family: var(--font-mono); font-size: 0.8125rem !important; word-break: break-all; }

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  a { color: var(--color-accent-text); font-size: 0.875rem; }
}

.cancel {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  h3 { font-size: 1rem; }
}

.counter { font-size: 0.75rem; color: var(--color-danger); text-align: right; &--ok { color: var(--color-success); } }
</style>
