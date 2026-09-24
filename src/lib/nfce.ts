// NFC-e simulada: chave de acesso no layout oficial (44 dígitos, DV módulo 11),
// mas sem transmissão à SEFAZ. Série e número vêm das Configurações.

function mod11(digits: string): number {
  let weight = 2
  let sum = 0
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function buildNfceKey(cnpj: string, series: number, number: number, issuedAt: Date): string {
  const uf    = '35'                                             // SP
  const aamm  = String(issuedAt.getFullYear()).slice(2) + String(issuedAt.getMonth() + 1).padStart(2, '0')
  const doc   = cnpj.replace(/\D/g, '').padStart(14, '0')
  const model = '65'                                             // NFC-e
  const serie = String(series).padStart(3, '0')
  const nNF   = String(number).padStart(9, '0')
  const tpEmi = '1'
  const cNF   = String((number * 7919 + 13) % 1e8).padStart(8, '0')
  const base  = uf + aamm + doc + model + serie + nNF + tpEmi + cNF
  return base + mod11(base)
}

export function formatKey(key: string): string {
  return key.replace(/(\d{4})(?=\d)/g, '$1 ')
}
