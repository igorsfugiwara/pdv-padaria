import type { Settings } from '@/types'

export type ComandaCheck =
  | { ok: true; number: string }
  | { ok: false; reason: string }

// Aceita o que vier do leitor ou do teclado: "42", "042", "CMD-0042", "0042",
// ou a URL do QR impresso na comanda (…/cortico?c=0042)
export function parseComandaCode(raw: string): string | null {
  const fromUrl = raw.match(/[?&]c=(\d+)/)
  const digits  = (fromUrl ? fromUrl[1] : raw).replace(/\D/g, '')
  if (!digits || digits.length > 6) return null
  const n = Number(digits)
  if (!Number.isFinite(n) || n <= 0) return null
  return String(n).padStart(3, '0')
}

export function checkComanda(raw: string, settings: Settings): ComandaCheck {
  const number = parseComandaCode(raw)
  if (!number) return { ok: false, reason: 'Não reconhecemos esse código. Tente de novo ou digite o número.' }
  const n = Number(number)
  if (n < settings.comandaMin || n > settings.comandaMax) {
    return { ok: false, reason: `A comanda ${number} não existe nesta casa.` }
  }
  if (settings.blockedComandas.includes(number)) {
    return { ok: false, reason: `A comanda ${number} está bloqueada. Troque por outra na entrada.` }
  }
  return { ok: true, number }
}
