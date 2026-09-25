import type { FiscalConfig, ProductFiscal } from '@/types'

// Dados fiscais da loja de demonstração. Emitente fictício (o CNPJ não é válido
// de propósito) e tributação de produtos como PONTO DE PARTIDA: NCM, CFOP e
// CSOSN têm de ser conferidos pelo contador antes da produção (revisado: false).

export const fiscalConfig: FiscalConfig = {
  provider:    'simulado',
  ambiente:    'simulado',
  razaoSocial: 'Cortiço Padaria e Café Ltda (fictício)',
  nomeFantasia: 'Cortiço',
  cnpj:        '12.345.678/0001-90',
  inscricaoEstadual: '123.456.789.110',
  crt: 1,
  endereco: {
    logradouro: 'Rua Exemplo',
    numero: '100',
    bairro: 'Centro',
    municipio: 'São Paulo',
    codigoMunicipio: '3550308',
    uf: 'SP',
    cep: '01001-000',
  },
  serie: 1,
  cancelamentoMinutos: 30,
  contingenciaHoras: 24,
  taxaServicoNaNota: false,
}

const made   = (ncm: string): ProductFiscal => ({ ncm, cfop: '5101', origem: '0', csosn: '102', unidade: 'UN', revisado: false })
const resale = (ncm: string): ProductFiscal => ({ ncm, cfop: '5102', origem: '0', csosn: '102', unidade: 'UN', revisado: false })

// por id de produto
export const productFiscal: Record<string, ProductFiscal> = {
  'p-chapa':   made('19059090'),
  misto:       made('21069090'),
  bauru:       made('21069090'),
  ovos:        made('21069090'),
  omelete:     made('21069090'),
  'x-egg':     made('21069090'),
  pf:          made('21069090'),
  contra:      made('21069090'),
  salada:      made('21069090'),
  frances:     made('19059090'),
  'pao-queijo': made('19059090'),
  croissant:   made('19059090'),
  italiano:    made('19059090'),
  coxinha:     made('19059090'),
  esfiha:      made('19059090'),
  empada:      made('19059090'),
  quiche:      made('19059090'),
  sonho:       made('19059090'),
  'bolo-fuba': made('19059090'),
  'bolo-cen':  made('19059090'),
  pudim:       made('19019090'),
  expresso:    made('21011200'),
  pingado:     made('21011200'),
  cappu:       made('21011200'),
  media:       made('21011200'),
  'suco-lar':  made('20091200'),
  vitamina:    made('22029900'),
  agua:        resale('22011000'),
  refri:       resale('22021000'),
}
