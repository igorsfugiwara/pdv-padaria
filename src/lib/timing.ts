import type { Order, Settings } from '@/types'
import { minutesBetween } from './format'

export type TimeLevel = 'ok' | 'warn' | 'late'

// Tempo de cozinha: do envio até ficar pronto (ou até agora, se ainda não ficou)
export function kitchenMinutes(o: Order, now: number): number {
  const end = o.readyAt ?? new Date(now).toISOString()
  return minutesBetween(o.createdAt, end)
}

// Tempo esperando o salão levar
export function waitingMinutes(o: Order, now: number): number {
  return o.readyAt ? minutesBetween(o.readyAt, new Date(now).toISOString()) : 0
}

export function timeLevel(minutes: number, s: Settings): TimeLevel {
  return minutes >= s.lateMinutes ? 'late' : minutes >= s.warnMinutes ? 'warn' : 'ok'
}

export const levelLabels: Record<TimeLevel, string> = {
  ok:   'No prazo',
  warn: 'Atenção',
  late: 'Atrasado',
}
