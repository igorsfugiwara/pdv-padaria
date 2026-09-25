import { describe, it, expect } from 'vitest'
import type { ComandaSession, FiscalConfig, Order, Payment, Product } from '../src/types'
import { distribute, buildNfceRequest, checkRequest, FiscalError } from '../src/fiscal/request'
import { toFocusPayload, fromFocusResponse, focusBase } from '../src/fiscal/focus'
import { isValidCpf, isValidCnpj, productFiscalIssues, configIssues } from '../src/fiscal/validate'

const config: FiscalConfig = {
  provider: 'focusnfe', ambiente: 'homologacao',
  razaoSocial: 'Padaria Teste Ltda', nomeFantasia: 'Teste', cnpj: '11.222.333/0001-81', inscricaoEstadual: '123456789110',
  crt: 1,
  endereco: { logradouro: 'Rua A', numero: '1', bairro: 'Centro', municipio: 'São Paulo', codigoMunicipio: '3550308', uf: 'SP', cep: '01001-000' },
  serie: 1, cancelamentoMinutos: 30, contingenciaHoras: 24, taxaServicoNaNota: false,
}

const fiscal = { ncm: '19059090', cfop: '5101', origem: '0', csosn: '102', unidade: 'UN' as const, revisado: true }
const product = (id: string, extra: Partial<Product> = {}): Product => ({
  id, name: id, description: '', price: 0, categoryId: 'c', emoji: '', station: 'cozinha',
  available: true, active: true, recipe: [], fiscal, ...extra,
})
const products = new Map([['pao', product('pao')], ['cafe', product('cafe')], ['suco', product('suco')]])

const item = (productId: string, unitPrice: number, quantity: number, extra = {}) => ({
  id: `${productId}-i`, productId, productName: productId === 'pao' ? 'Pão na chapa' : productId, categoryId: 'c', emoji: '',
  station: 'cozinha' as const, unitPrice, unitCost: 0, quantity, choices: [], ...extra,
})

const order = (items: ReturnType<typeof item>[]): Order => ({
  id: 'o1', number: 1, comandaId: 'c1', comandaNumber: '042', destination: { type: 'mesa', table: 3 },
  origin: 'cliente', items, status: 'delivered', createdAt: '2026-09-25T10:00:00.000Z',
})

const comanda: ComandaSession = { id: 'comanda-teste-123', number: '042', status: 'closed', origin: 'cliente', openedAt: '2026-09-25T10:00:00.000Z' }

const payment = (p: Partial<Payment>): Payment => ({
  subtotal: 0, discount: 0, serviceFee: 0, total: 0, method: 'pix',
  paidAt: '2026-09-25T10:30:00.000Z', operator: 'Marta', cashierSessionId: 's1', ...p,
})

const build = (orders: Order[], pay: Payment, cfg = config, cpf?: string) =>
  buildNfceRequest({ ref: comanda.id, tenant: 'cortico', comanda, orders, products, config: cfg, payment: pay, cpf, now: new Date('2026-09-25T10:30:00Z') })

describe('distribute', () => {
  it('reparte sem perder centavo', () => {
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(distribute(1000, [650, 1400, 1100]).reduce((a, b) => a + b, 0)).toBe(1000)
    expect(distribute(0, [1, 2])).toEqual([0, 0])
    expect(distribute(7, [0, 0])).toEqual([0, 0])
  })
})

describe('buildNfceRequest', () => {
  it('monta itens, totais e PIX', () => {
    const req = build([order([item('pao', 650, 2), item('cafe', 700, 1)])], payment({ subtotal: 2000, total: 2000 }))
    expect(req.itens).toHaveLength(2)
    expect(req.itens[0]).toMatchObject({ numero: 1, ncm: '19059090', cfop: '5101', csosn: '102', valorBruto: 1300, quantidade: 2 })
    expect(req.totais).toEqual({ produtos: 2000, desconto: 0, outros: 0, total: 2000 })
    expect(req.pagamentos).toEqual([{ tPag: '17', valor: 2000, cartao: false }])
    expect(checkRequest(req)).toEqual([])
  })

  it('distribui o desconto pelos itens e fecha no centavo', () => {
    const req = build([order([item('pao', 650, 1), item('cafe', 700, 1), item('suco', 1100, 1)])],
      payment({ subtotal: 2450, discount: 245, total: 2205, method: 'credito' }))
    expect(req.itens.reduce((s, i) => s + i.desconto, 0)).toBe(245)
    expect(req.totais.total).toBe(2205)
    expect(req.pagamentos[0]).toEqual({ tPag: '03', valor: 2205, cartao: true })
    expect(checkRequest(req)).toEqual([])
  })

  it('taxa de serviço fora da nota: pagamento reduzido ao total da nota', () => {
    const req = build([order([item('pao', 1000, 1)])], payment({ subtotal: 1000, serviceFee: 100, total: 1100, method: 'dinheiro', received: 2000, change: 900 }))
    expect(req.totais.total).toBe(1000)
    expect(req.pagamentos).toEqual([{ tPag: '01', valor: 1000, cartao: false }])
    expect(checkRequest(req)).toEqual([])
  })

  it('taxa de serviço na nota vira "outras despesas"', () => {
    const req = build([order([item('pao', 650, 1), item('cafe', 700, 1)])], payment({ subtotal: 1350, serviceFee: 135, total: 1485 }), { ...config, taxaServicoNaNota: true })
    expect(req.itens.reduce((s, i) => s + i.outros, 0)).toBe(135)
    expect(req.totais.total).toBe(1485)
    expect(checkRequest(req)).toEqual([])
  })

  it('pagamento misto vira uma forma por parcela', () => {
    const req = build([order([item('pao', 1000, 1)])],
      payment({ subtotal: 1000, total: 1000, method: 'misto', parts: [{ method: 'pix', amount: 400 }, { method: 'voucher', amount: 600 }] }))
    expect(req.pagamentos).toEqual([{ tPag: '17', valor: 400, cartao: false }, { tPag: '11', valor: 600, cartao: true }])
  })

  it('itens cancelados ficam fora', () => {
    const req = build([order([item('pao', 650, 1), item('cafe', 700, 1, { cancelled: { at: 'x', by: 'y', reason: 'z' } })])], payment({ subtotal: 650, total: 650 }))
    expect(req.itens).toHaveLength(1)
  })

  it('descreve adicionais e aceita CPF', () => {
    const req = build([order([item('pao', 950, 1, { choices: [{ groupId: 'a', groupName: 'Adicionais', choiceId: 'q', name: 'Queijo prato', price: 300 }] })])],
      payment({ subtotal: 950, total: 950 }), config, '529.982.247-25')
    expect(req.itens[0].descricao).toBe('Pão na chapa (Queijo prato)')
    expect(req.cpf).toBe('52998224725')
  })

  it('recusa produto sem cadastro fiscal, dizendo qual', () => {
    const noFiscal = new Map([['pao', product('pao', { fiscal: undefined })]])
    expect(() => buildNfceRequest({ ref: comanda.id, tenant: 'cortico', comanda, orders: [order([item('pao', 650, 1)])], products: noFiscal, config, payment: payment({ subtotal: 650, total: 650 }) }))
      .toThrowError(FiscalError)
  })

  it('não monta nota no modo simulado', () => {
    expect(() => build([order([item('pao', 650, 1)])], payment({ subtotal: 650, total: 650 }), { ...config, provider: 'simulado', ambiente: 'simulado' }))
      .toThrowError(/simulado/)
  })
})

describe('checkRequest', () => {
  it('pega totais que não fecham', () => {
    const req = build([order([item('pao', 650, 1)])], payment({ subtotal: 650, total: 650 }))
    req.pagamentos[0].valor = 600
    expect(checkRequest(req).join()).toMatch(/Pagamentos/)
  })
})

describe('Focus NFe', () => {
  it('converte para o formato da API', () => {
    const req = build([order([item('pao', 650, 2)])], payment({ subtotal: 1300, discount: 100, total: 1200, method: 'debito' }), config, '52998224725')
    const p = toFocusPayload(req) as Record<string, any>
    expect(p).toMatchObject({ cnpj_emitente: '11222333000181', presenca_comprador: '1', modalidade_frete: '9', local_destino: '1', cpf_destinatario: '52998224725' })
    expect(p.items[0]).toMatchObject({
      numero_item: '1', codigo_ncm: '19059090', cfop: '5101', quantidade_comercial: 2,
      valor_unitario_comercial: 6.5, valor_bruto: 13, valor_desconto: 1, icms_origem: '0', icms_situacao_tributaria: '102',
    })
    expect(p.formas_pagamento).toEqual([{ forma_pagamento: '04', valor_pagamento: 12, tipo_integracao: '2' }])
  })

  it('normaliza a resposta', () => {
    const r = fromFocusResponse({
      status: 'autorizado', status_sefaz: '100', mensagem_sefaz: 'Autorizado o uso da NF-e',
      chave_nfe: 'NFe35260911222333000181650010000000121000000121', numero: '12', serie: '1',
      caminho_danfe: '/notas_fiscais_consumidor/x.html', qrcode_url: 'https://sefaz/qr?p=1',
    }, focusBase.homologacao)
    expect(r).toMatchObject({ status: 'autorizada', codigoSefaz: '100', numero: 12, serie: 1, chave: '35260911222333000181650010000000121000000121' })
    expect(r.danfeUrl).toBe('https://homologacao.focusnfe.com.br/notas_fiscais_consumidor/x.html')
    expect(fromFocusResponse({ status: 'erro_autorizacao', mensagem_sefaz: 'Rejeição' }, '').status).toBe('rejeitada')
    expect(fromFocusResponse({ status: 'autorizado', contingencia_offline: true }, '').status).toBe('contingencia')
  })
})

describe('validações', () => {
  it('CPF e CNPJ', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('12.345.678/0001-90')).toBe(false)
  })

  it('cadastro fiscal do produto', () => {
    expect(productFiscalIssues(fiscal, 1)).toEqual([])
    expect(productFiscalIssues({ ...fiscal, ncm: '1905' }, 1)).toContain('NCM precisa de 8 dígitos')
    expect(productFiscalIssues({ ...fiscal, cstIcms: undefined }, 3)).toContain('Falta o CST do ICMS')
    expect(productFiscalIssues(undefined, 1)).toEqual(['Sem cadastro fiscal'])
  })

  it('emitente', () => {
    expect(configIssues(config)).toEqual([])
    expect(configIssues({ ...config, cnpj: '123' })).toContain('CNPJ inválido')
  })
})
