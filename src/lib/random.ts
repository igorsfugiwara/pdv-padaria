// PRNG determinístico (mulberry32): o histórico mockado sai igual a cada carga

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRandom(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    // escolha ponderada: [[valor, peso], ...]
    weighted: <T>(entries: [T, number][]): T => {
      const total = entries.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [v, w] of entries) {
        r -= w
        if (r <= 0) return v
      }
      return entries[entries.length - 1][0]
    },
  }
}

export type Random = ReturnType<typeof createRandom>
