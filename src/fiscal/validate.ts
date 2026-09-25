import type { FiscalConfig, ProductFiscal } from '../types'

export const onlyDigits = (s: string) => (s ?? '').replace(/\D/g, '')

export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw)
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  const dv = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10])
}

export function isValidCnpj(raw: string): boolean {
  const c = onlyDigits(raw)
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const dv = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = w.reduce((s, wi, i) => s + Number(c[i]) * wi, 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13])
}

export function formatCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) => `${a}.${b}.${c}${e ? '-' + e : ''}`)
}

// O que falta no cadastro fiscal de um produto (vazio = pronto para emitir)
export function productFiscalIssues(f: ProductFiscal | undefined, crt: 1 | 3): string[] {
  if (!f) return ['Sem cadastro fiscal']
  const issues: string[] = []
  if (!/^\d{8}$/.test(onlyDigits(f.ncm))) issues.push('NCM precisa de 8 dígitos')
  if (f.cest && !/^\d{7}$/.test(onlyDigits(f.cest))) issues.push('CEST precisa de 7 dígitos')
  if (!/^\d{4}$/.test(f.cfop)) issues.push('CFOP inválido')
  if (!/^[0-8]$/.test(f.origem)) issues.push('Origem inválida')
  if (crt === 1 && !f.csosn) issues.push('Falta o CSOSN')
  if (crt === 3 && !f.cstIcms) issues.push('Falta o CST do ICMS')
  if (f.gtin && !/^(\d{8}|\d{12,14})$/.test(onlyDigits(f.gtin))) issues.push('GTIN inválido')
  return issues
}

// O que falta na configuração do emitente para sair do modo simulado
export function configIssues(c: FiscalConfig): string[] {
  const issues: string[] = []
  if (!isValidCnpj(c.cnpj)) issues.push('CNPJ inválido')
  if (!c.razaoSocial.trim()) issues.push('Falta a razão social')
  if (!onlyDigits(c.inscricaoEstadual)) issues.push('Falta a inscrição estadual')
  if (!/^\d{7}$/.test(onlyDigits(c.endereco.codigoMunicipio))) issues.push('Código IBGE do município precisa de 7 dígitos')
  if (!/^[A-Z]{2}$/.test(c.endereco.uf)) issues.push('UF inválida')
  if (!/^\d{8}$/.test(onlyDigits(c.endereco.cep))) issues.push('CEP inválido')
  if (!c.endereco.logradouro.trim() || !c.endereco.numero.trim() || !c.endereco.bairro.trim()) issues.push('Endereço incompleto')
  if (c.serie < 1 || c.serie > 999) issues.push('Série entre 1 e 999')
  return issues
}
