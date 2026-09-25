import { defineStore } from 'pinia'
import { computed } from 'vue'
import { where } from 'firebase/firestore'
import type { ComandaSession, NfceDoc, NfceStatus } from '@/types'
import { auth, firebaseEnabled } from '@/firebase'
import { useCollection } from '@/db/collection'
import { dbContext } from '@/db/context'
import { localSeed } from '@/db/seed'
import { tenantSlug } from '@/db/tenant'
import { buildNfceRequest, FiscalError } from '@/fiscal/request'
import type { FiscalResult } from '@/fiscal/focus'
import { configIssues, productFiscalIssues } from '@/fiscal/validate'
import { buildNfceKey } from '@/lib/nfce'
import { startOfDay } from '@/lib/format'
import { useSettingsStore } from './useSettingsStore'
import { useComandasStore } from './useComandasStore'
import { useOrderStore } from './useOrderStore'
import { useCatalogStore } from './useCatalogStore'
import { useStaffStore } from './useStaffStore'

export interface ServerStatus {
  provider: string
  tokens: { homologacao: boolean; producao: boolean }
}

// NFC-e: o documento nasce "pendente" ANTES de ir ao provedor, com a referência
// = id da comanda. Se a conexão cair no meio, "Consultar" recupera o resultado
// pelo mesmo id, e a venda nunca se perde (o pagamento já foi gravado).
export const useFiscalStore = defineStore('fiscal', () => {
  const coll = useCollection<NfceDoc>('nfce', {
    local: () => localSeed().collections.nfce,
    sources: () => {
      if (dbContext.staffRole !== 'caixa' && dbContext.staffRole !== 'gerente') return []
      const since = new Date(startOfDay().getTime() - 7 * 86_400_000).toISOString()
      return [{ kind: 'query', key: `since-${since}`, constraints: [where('criadaEm', '>=', since)] }]
    },
  })

  const settings = useSettingsStore()
  const config   = computed(() => settings.settings.fiscal)
  const docs     = computed(() => [...coll.items.value].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)))
  const byId     = computed(() => new Map(coll.items.value.map((d) => [d.id, d])))
  const isReal   = computed(() => config.value.provider !== 'simulado' && config.value.ambiente !== 'simulado')

  const count = (s: NfceStatus) => coll.items.value.filter((d) => d.status === s).length
  const attention = computed(() => count('pendente') + count('rejeitada') + count('contingencia'))

  // O que falta para emitir de verdade
  const readiness = computed(() => {
    const catalog = useCatalogStore()
    const active  = catalog.activeProducts
    const incomplete = active.filter((p) => productFiscalIssues(p.fiscal, config.value.crt).length)
    return {
      emitente: configIssues(config.value),
      produtosIncompletos: incomplete,
      produtosNaoRevisados: active.filter((p) => !incomplete.includes(p) && !p.fiscal?.revisado),
      totalProdutos: active.length,
    }
  })

  // ── Servidor (/api/nfce) ────────────────────────────────────────────────
  async function api<T>(body: Record<string, unknown>): Promise<T> {
    if (!firebaseEnabled || !auth?.currentUser) throw new FiscalError('A emissão real precisa do Firestore e do login da equipe')
    const token = await auth.currentUser.getIdToken()
    let r: Response
    try {
      r = await fetch('/api/nfce', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant: tenantSlug(), ambiente: config.value.ambiente, ...body }),
      })
    } catch {
      throw new FiscalError('Sem conexão com o servidor fiscal')
    }
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new FiscalError(data.erro ?? `Erro ${r.status} no servidor fiscal`, data.detalhes ?? [])
    return data as T
  }

  function serverStatus(): Promise<ServerStatus> {
    return api<ServerStatus>({ action: 'status' })
  }

  // ── Emissão ─────────────────────────────────────────────────────────────
  async function save(doc: NfceDoc, patch: Partial<NfceDoc>) {
    Object.assign(doc, patch)
    await coll.commit()
    await linkToPayment(doc)
  }

  // Resumo da nota no pagamento da comanda (recibo, caixa, relatórios)
  async function linkToPayment(doc: NfceDoc) {
    const comandas = useComandasStore()
    const s = comandas.byId.get(doc.comandaId)
    if (!s?.payment) return
    s.payment.nfce = {
      ref: doc.id, status: doc.status, ambiente: doc.ambiente,
      number: doc.numero ?? 0, series: doc.serie ?? config.value.serie, key: doc.chave ?? '', issuedAt: doc.autorizadaEm ?? doc.criadaEm,
    }
    await comandas.commit()
  }

  function applyResult(doc: NfceDoc, r: FiscalResult): Partial<NfceDoc> {
    const now = new Date().toISOString()
    return {
      status: r.status === 'erro' ? (doc.status === 'pendente' ? 'pendente' : doc.status) : r.status,
      mensagem: r.mensagem,
      codigoSefaz: r.codigoSefaz,
      numero: r.numero ?? doc.numero,
      serie: r.serie ?? doc.serie,
      chave: r.chave ?? doc.chave,
      protocolo: r.protocolo ?? doc.protocolo,
      qrcodeUrl: r.qrcodeUrl ?? doc.qrcodeUrl,
      urlConsulta: r.urlConsulta ?? doc.urlConsulta,
      danfeUrl: r.danfeUrl ?? doc.danfeUrl,
      xmlUrl: r.xmlUrl ?? doc.xmlUrl,
      autorizadaEm: (r.status === 'autorizada' || r.status === 'contingencia') ? doc.autorizadaEm ?? now : doc.autorizadaEm,
    }
  }

  async function send(doc: NfceDoc, session: ComandaSession): Promise<NfceDoc> {
    const staff = useStaffStore()
    doc.tentativas++
    doc.operador = staff.user?.name ?? doc.operador

    if (!isReal.value) {
      const number = doc.numero ?? await useComandasStore().nextNfceNumber()
      const now = new Date()
      await save(doc, {
        status: 'autorizada', provider: 'simulado', ambiente: 'simulado',
        numero: number, serie: config.value.serie,
        chave: buildNfceKey(config.value.cnpj, config.value.serie, number, now),
        autorizadaEm: now.toISOString(), mensagem: undefined,
      })
      return doc
    }

    try {
      const request = buildNfceRequest({
        ref: doc.id,
        tenant: tenantSlug(),
        comanda: session,
        orders: useOrderStore().byComanda(session.id),
        products: useCatalogStore().productById,
        config: config.value,
        payment: session.payment!,
        cpf: doc.cpf,
      })
      const result = await api<FiscalResult>({ action: 'emitir', request })
      await save(doc, applyResult(doc, result))
    } catch (err) {
      const e = err as FiscalError
      await save(doc, {
        status: doc.status === 'pendente' && e.message.startsWith('Sem conexão') ? 'pendente' : 'rejeitada',
        mensagem: [e.message, ...(e.details ?? [])].join(' · '),
      })
    }
    return doc
  }

  async function emitir(session: ComandaSession, opts: { cpf?: string } = {}): Promise<NfceDoc> {
    const existing = byId.value.get(session.id)
    if (existing && existing.status !== 'rejeitada' && existing.status !== 'pendente') return existing
    const doc: NfceDoc = existing ?? {
      id: session.id,
      comandaId: session.id,
      comandaNumber: session.number,
      status: 'pendente',
      provider: config.value.provider,
      ambiente: isReal.value ? config.value.ambiente : 'simulado',
      total: session.payment?.total ?? 0,
      cpf: opts.cpf,
      criadaEm: new Date().toISOString(),
      tentativas: 0,
      operador: useStaffStore().user?.name ?? 'Caixa',
    }
    if (!existing) {
      await coll.add(doc)
      await linkToPayment(doc)
    }
    return send(byId.value.get(doc.id) ?? doc, session)
  }

  async function reenviar(id: string): Promise<NfceDoc | null> {
    const doc = byId.value.get(id)
    const session = doc && useComandasStore().byId.get(doc.comandaId)
    if (!doc || !session) return null
    return send(doc, session)
  }

  async function consultar(id: string): Promise<void> {
    const doc = byId.value.get(id)
    if (!doc || doc.ambiente === 'simulado') return
    const result = await api<FiscalResult>({ action: 'consultar', ref: id, ambiente: doc.ambiente })
    if (result.status !== 'erro') await save(doc, applyResult(doc, result))
    else await save(doc, { mensagem: result.mensagem })
  }

  // ── Cancelamento ────────────────────────────────────────────────────────
  function cancelDeadline(doc: NfceDoc): Date | null {
    if (!doc.autorizadaEm) return null
    return new Date(new Date(doc.autorizadaEm).getTime() + config.value.cancelamentoMinutos * 60_000)
  }

  function canCancel(doc: NfceDoc, now = Date.now()): boolean {
    const d = cancelDeadline(doc)
    return doc.status === 'autorizada' && !!d && now <= d.getTime()
  }

  async function cancelar(id: string, justificativa: string): Promise<{ ok: boolean; mensagem?: string }> {
    const doc = byId.value.get(id)
    if (!doc) return { ok: false, mensagem: 'Nota não encontrada' }
    const texto = justificativa.trim()
    if (texto.length < 15) return { ok: false, mensagem: 'A justificativa precisa de pelo menos 15 caracteres' }
    if (!canCancel(doc)) return { ok: false, mensagem: `Fora do prazo de ${config.value.cancelamentoMinutos} minutos para cancelar` }

    const por = useStaffStore().user?.name ?? 'Caixa'
    if (doc.ambiente === 'simulado') {
      await save(doc, { status: 'cancelada', cancelamento: { em: new Date().toISOString(), justificativa: texto, por } })
      return { ok: true }
    }
    const result = await api<FiscalResult>({ action: 'cancelar', ref: id, ambiente: doc.ambiente, justificativa: texto })
    if (result.status !== 'cancelada') return { ok: false, mensagem: result.mensagem ?? 'Cancelamento recusado' }
    await save(doc, {
      status: 'cancelada',
      xmlUrl: result.xmlUrl ?? doc.xmlUrl,
      cancelamento: { em: new Date().toISOString(), justificativa: texto, por, protocolo: result.protocolo },
    })
    return { ok: true }
  }

  // Contingência: prazo para a nota ser transmitida
  function contingencyDeadline(doc: NfceDoc): Date {
    return new Date(new Date(doc.criadaEm).getTime() + config.value.contingenciaHoras * 3_600_000)
  }

  return {
    docs, byId, config, isReal, attention, readiness,
    emitir, reenviar, consultar, cancelar, canCancel, cancelDeadline, contingencyDeadline, serverStatus,
    count,
  }
})
