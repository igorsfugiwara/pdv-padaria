// Tabelas fiscais da NFC-e (modelo 65). Sem imports com "@/": este módulo também
// roda na função do servidor (netlify/functions).
import type { SimpleMethod } from '../types'

// tPag (forma de pagamento) do leiaute NF-e/NFC-e
export const tPagByMethod: Record<SimpleMethod, string> = {
  dinheiro: '01',
  credito:  '03',
  debito:   '04',
  voucher:  '11',   // vale-refeição
  pix:      '17',   // pagamento instantâneo (PIX)
}

export const cardMethods: SimpleMethod[] = ['credito', 'debito', 'voucher']

export const csosnOptions = [
  { value: '102', label: '102 · Tributada pelo Simples sem permissão de crédito' },
  { value: '103', label: '103 · Isenção do ICMS no Simples para faixa de receita' },
  { value: '300', label: '300 · Imune' },
  { value: '400', label: '400 · Não tributada pelo Simples' },
  { value: '500', label: '500 · ICMS cobrado anteriormente por ST' },
  { value: '900', label: '900 · Outros' },
]

export const cstIcmsOptions = [
  { value: '00', label: '00 · Tributada integralmente' },
  { value: '20', label: '20 · Com redução de base de cálculo' },
  { value: '40', label: '40 · Isenta' },
  { value: '41', label: '41 · Não tributada' },
  { value: '60', label: '60 · ICMS cobrado anteriormente por ST' },
]

export const cfopOptions = [
  { value: '5101', label: '5101 · Venda de produção própria' },
  { value: '5102', label: '5102 · Venda de mercadoria de terceiros (revenda)' },
  { value: '5405', label: '5405 · Revenda com ST (substituído)' },
]

export const origemOptions = [
  { value: '0', label: '0 · Nacional' },
  { value: '1', label: '1 · Estrangeira, importação direta' },
  { value: '2', label: '2 · Estrangeira, adquirida no mercado interno' },
]

export const ambienteLabels = {
  simulado:    'Simulada',
  homologacao: 'Homologação',
  producao:    'Produção',
} as const

export const statusLabels = {
  pendente:     'Pendente',
  autorizada:   'Autorizada',
  rejeitada:    'Rejeitada',
  cancelada:    'Cancelada',
  contingencia: 'Contingência',
} as const
