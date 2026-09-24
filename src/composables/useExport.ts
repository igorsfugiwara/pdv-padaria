// Exportação CSV (mesmo padrão do Casa Ó: ; como separador, abre direto no Excel)

export function toCSV(header: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header, ...rows].map((r) => r.map(esc).join(';')).join('\n')
}

export function centsToReal(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function downloadFile(content: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['﻿' + content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
