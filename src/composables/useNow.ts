import { ref, onMounted, onBeforeUnmount } from 'vue'

// Relógio reativo para cronômetros de pedido
export function useNow(intervalMs = 15_000) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, intervalMs) })
  onBeforeUnmount(() => { if (timer) clearInterval(timer) })
  return now
}
