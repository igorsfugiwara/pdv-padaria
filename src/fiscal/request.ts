// Monta a NFC-e num formato neutro (independente do provedor) a partir da
// comanda paga. Valores em centavos, inteiros: a soma sempre fecha no centavo.
import type { ComandaSession, FiscalConfig, Order, Payment, Product, SimpleMethod } from '../types'
import { tPagByMethod, cardMethods } from './codes'
import { onlyDigits, productFiscalIssues } from './validate'

export interface NfceItem {
  numero: number
  codigo: string
  descricao: string
  ncm: string
  cest?: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorBruto: number
  desconto: number
  outros: number
  origem: string
  csosn?: string
  cstIcms?: string
  aliquotaIcms?: number
  gtin?: string
  cstPisCofins?: string
  ibsCbsCst?: string
  ibsCbsClassTrib?: string
}

export interface NfcePagamento {
  tPag: string
  valor: number
  cartao: boolean          // maquininha não integrada (tpIntegra 2)
}

export interface NfceRequest {
  ref: string
  tenant: string
  ambiente: 'homologacao' | 'producao'
  crt: 1 | 3
  emitenteCnpj: string
  dataEmissao: string
  cpf?: string
  itens: NfceItem[]
  pagamentos: NfcePagamento[]
  informacoesAdicionais?: string
  totais: { produtos: number; desconto: number; outros: number; total: number }
}

export class FiscalError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message)
  }
}

// Reparte `total` em partes proporcionais a `weights`, sem perder centavo:
// as sobras do arredondamento vão para os maiores restos
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (!total || !sum) return weights.map(() => 0)
  const raw   = weights.map((w) => (total * w) / sum)
  const parts = raw.map(Math.floor)
  let rest = total - parts.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0])
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) parts[order[k][1]]++
  return parts
}

function describe(name: string, choices: { name: string }[]): string {
  const d = choices.length ? `${name} (${choices.map((c) => c.name).join(', ')})` : name
  return d.length > 120 ? d.slice(0, 117) + '...' : d
}

export function buildNfceRequest(input: {
  ref: string
  tenant: string
  comanda: ComandaSession
  orders: Order[]
  products: Map<string, Product>
  config: FiscalConfig
  payment: Payment
  cpf?: string
  now?: Date
}): NfceRequest {
  const { config, payment } = input
  if (config.ambiente === 'simulado') throw new FiscalError('NFC-e está no modo simulado')

  const lines = input.orders.flatMap((o) => o.items.filter((i) => !i.cancelled))
  if (!lines.length) throw new FiscalError('Comanda sem itens para a nota')

  // Cadastro fiscal completo em todos os produtos vendidos
  const missing: string[] = []
  for (const l of lines) {
    const issues = productFiscalIssues(input.products.get(l.productId)?.fiscal, config.crt)
    if (issues.length) missing.push(`${l.productName}: ${issues.join(', ')}`)
  }
  if (missing.length) throw new FiscalError('Produtos sem cadastro fiscal completo', [...new Set(missing)])

  const brutos   = lines.map((l) => l.unitPrice * l.quantity)
  const produtos = brutos.reduce((a, b) => a + b, 0)
  const outrosTotal = config.taxaServicoNaNota ? payment.serviceFee : 0
  const descontos = distribute(payment.discount, brutos)
  const outros    = distribute(outrosTotal, brutos)
  const total     = produtos - payment.discount + outrosTotal

  const itens: NfceItem[] = lines.map((l, idx) => {
    const f = input.products.get(l.productId)!.fiscal!
    return {
      numero: idx + 1,
      codigo: l.productId.slice(0, 60),
      descricao: describe(l.productName, l.choices),
      ncm: onlyDigits(f.ncm),
      cest: f.cest ? onlyDigits(f.cest) : undefined,
      cfop: f.cfop,
      unidade: f.unidade,
      quantidade: l.quantity,
      valorUnitario: l.unitPrice,
      valorBruto: brutos[idx],
      desconto: descontos[idx],
      outros: outros[idx],
      origem: f.origem,
      csosn: config.crt === 1 ? f.csosn : undefined,
      cstIcms: config.crt === 3 ? f.cstIcms : undefined,
      aliquotaIcms: config.crt === 3 ? f.aliquotaIcms : undefined,
      gtin: f.gtin ? onlyDigits(f.gtin) : undefined,
      cstPisCofins: f.cstPisCofins,
      ibsCbsCst: f.ibsCbsCst,
      ibsCbsClassTrib: f.ibsCbsClassTrib,
    }
  })

  // Pagamentos somam exatamente o total da nota. O troco não vai para a nota
  // (é opcional no leiaute) e a taxa de serviço fora da nota sai proporcionalmente.
  const parts: { method: SimpleMethod; amount: number }[] =
    payment.method === 'misto' ? payment.parts ?? [] : [{ method: payment.method, amount: payment.total }]
  const valores = distribute(total, parts.map((p) => p.amount))
  const pagamentos: NfcePagamento[] = parts.map((p, i) => ({
    tPag: tPagByMethod[p.method],
    valor: valores[i],
    cartao: cardMethods.includes(p.method),
  }))

  const cpf = input.cpf ? onlyDigits(input.cpf) : undefined

  return {
    ref: input.ref,
    tenant: input.tenant,
    ambiente: config.ambiente,
    crt: config.crt,
    emitenteCnpj: onlyDigits(config.cnpj),
    dataEmissao: (input.now ?? new Date()).toISOString(),
    cpf: cpf || undefined,
    itens,
    pagamentos,
    informacoesAdicionais: [config.informacoesAdicionais, `Comanda ${input.comanda.number}`].filter(Boolean).join(' · '),
    totais: { produtos, desconto: payment.discount, outros: outrosTotal, total },
  }
}

// Conferência antes de enviar (também roda no servidor, que não confia no navegador)
export function checkRequest(req: NfceRequest): string[] {
  const errors: string[] = []
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(req.ref)) errors.push('Referência inválida')
  if (!req.itens.length) errors.push('Sem itens')
  const soma = req.itens.reduce((s, i) => s + i.valorBruto - i.desconto + i.outros, 0)
  if (soma !== req.totais.total) errors.push(`Itens (${soma}) não fecham com o total (${req.totais.total})`)
  const pagos = req.pagamentos.reduce((s, p) => s + p.valor, 0)
  if (pagos !== req.totais.total) errors.push(`Pagamentos (${pagos}) não fecham com o total (${req.totais.total})`)
  for (const i of req.itens) {
    if (i.valorBruto !== i.valorUnitario * i.quantidade) errors.push(`Item ${i.numero}: valor bruto não confere`)
    if (!/^\d{8}$/.test(i.ncm)) errors.push(`Item ${i.numero}: NCM inválido`)
  }
  if (req.cpf && req.cpf.length !== 11) errors.push('CPF inválido')
  return errors
}
