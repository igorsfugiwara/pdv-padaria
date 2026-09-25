// Adaptador Focus NFe (https://doc.focusnfe.com.br). NFC-e é síncrona: a
// resposta já diz se foi autorizada ou rejeitada. Autenticação: HTTP Basic com
// o token da empresa como usuário e senha vazia.
import type { NfceStatus } from '../types'
import type { NfceRequest } from './request'

export const focusBase = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao:    'https://api.focusnfe.com.br',
} as const

const reais = (cents: number) => Math.round(cents) / 100

export function toFocusPayload(req: NfceRequest): Record<string, unknown> {
  return {
    cnpj_emitente: req.emitenteCnpj,
    data_emissao: req.dataEmissao,
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    presenca_comprador: '1',       // operação presencial
    modalidade_frete: '9',         // sem frete
    local_destino: '1',            // operação interna
    ...(req.cpf ? { cpf_destinatario: req.cpf } : {}),
    ...(req.informacoesAdicionais ? { informacoes_adicionais_contribuinte: req.informacoesAdicionais } : {}),
    items: req.itens.map((i) => ({
      numero_item: String(i.numero),
      codigo_produto: i.codigo,
      descricao: i.descricao,
      codigo_ncm: i.ncm,
      ...(i.cest ? { cest: i.cest } : {}),
      cfop: i.cfop,
      unidade_comercial: i.unidade,
      unidade_tributavel: i.unidade,
      quantidade_comercial: i.quantidade,
      quantidade_tributavel: i.quantidade,
      valor_unitario_comercial: reais(i.valorUnitario),
      valor_unitario_tributavel: reais(i.valorUnitario),
      valor_bruto: reais(i.valorBruto),
      ...(i.desconto ? { valor_desconto: reais(i.desconto) } : {}),
      ...(i.outros ? { valor_outras_despesas: reais(i.outros) } : {}),
      ...(i.gtin ? { codigo_barras_comercial: i.gtin, codigo_barras_tributavel: i.gtin } : {}),
      icms_origem: i.origem,
      icms_situacao_tributaria: req.crt === 1 ? i.csosn : i.cstIcms,
      ...(req.crt === 3 && i.aliquotaIcms !== undefined
        ? {
            icms_aliquota: i.aliquotaIcms,
            icms_base_calculo: reais(i.valorBruto - i.desconto + i.outros),
            icms_valor: reais(Math.round((i.valorBruto - i.desconto + i.outros) * i.aliquotaIcms / 100)),
          }
        : {}),
      ...(i.cstPisCofins ? { pis_situacao_tributaria: i.cstPisCofins, cofins_situacao_tributaria: i.cstPisCofins } : {}),
      ...(i.ibsCbsCst ? { ibs_cbs_situacao_tributaria: i.ibsCbsCst } : {}),
      ...(i.ibsCbsClassTrib ? { ibs_cbs_classificacao_tributaria: i.ibsCbsClassTrib } : {}),
    })),
    formas_pagamento: req.pagamentos.map((p) => ({
      forma_pagamento: p.tPag,
      valor_pagamento: reais(p.valor),
      ...(p.cartao ? { tipo_integracao: '2' } : {}),
    })),
  }
}

// Resultado normalizado, o mesmo para qualquer provedor
export interface FiscalResult {
  status: NfceStatus | 'erro'
  mensagem?: string
  codigoSefaz?: string
  numero?: number
  serie?: number
  chave?: string
  protocolo?: string
  qrcodeUrl?: string
  urlConsulta?: string
  danfeUrl?: string
  xmlUrl?: string
}

export function fromFocusResponse(body: Record<string, unknown>, base: string): FiscalResult {
  const s = String(body.status ?? '')
  const abs = (p: unknown) => (typeof p === 'string' && p ? (p.startsWith('http') ? p : base + p) : undefined)
  const offline = body.contingencia_offline === true && body.contingencia_offline_efetivada !== true
  const status: FiscalResult['status'] =
    s === 'autorizado' ? (offline ? 'contingencia' : 'autorizada')
    : s === 'cancelado' ? 'cancelada'
    : s === 'erro_autorizacao' || s === 'denegado' ? 'rejeitada'
    : s === 'processando_autorizacao' ? 'pendente'
    : 'erro'
  return {
    status,
    mensagem:    (body.mensagem_sefaz ?? body.mensagem) as string | undefined,
    codigoSefaz: body.status_sefaz as string | undefined,
    numero:      body.numero ? Number(body.numero) : undefined,
    serie:       body.serie ? Number(body.serie) : undefined,
    chave:       typeof body.chave_nfe === 'string' ? body.chave_nfe.replace(/^NFe/, '') : undefined,
    protocolo:   (body.protocolo ?? body.numero_protocolo) as string | undefined,
    qrcodeUrl:   body.qrcode_url as string | undefined,
    urlConsulta: body.url_consulta_nf as string | undefined,
    danfeUrl:    abs(body.caminho_danfe),
    xmlUrl:      abs(body.caminho_xml_nota_fiscal ?? body.caminho_xml_cancelamento),
  }
}
