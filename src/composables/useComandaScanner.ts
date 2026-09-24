import { ref, onBeforeUnmount } from 'vue'

export type ScanState = 'idle' | 'starting' | 'scanning' | 'paused' | 'denied' | 'no-camera' | 'insecure' | 'error'

interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}

// Formatos comuns em comanda impressa: Code 128/39, ITF, EAN e QR
const FORMATS = ['code_128', 'code_39', 'itf', 'ean_13', 'ean_8', 'codabar', 'qr_code'] as const

// Usa o BarcodeDetector nativo (Chrome/Android). Onde não existe (Safari/iOS,
// Firefox), carrega sob demanda o ponyfill em WebAssembly (zxing-wasm).
async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: {
    new (opts: { formats: string[] }): Detector
    getSupportedFormats(): Promise<string[]>
  } }).BarcodeDetector

  if (Native) {
    const supported = await Native.getSupportedFormats()
    const formats   = FORMATS.filter((f) => supported.includes(f))
    if (formats.length) return new Native({ formats })
  }

  const { BarcodeDetector } = await import('barcode-detector/ponyfill')
  return new BarcodeDetector({ formats: [...FORMATS] })
}

export function useComandaScanner(onCode: (raw: string) => void) {
  const video = ref<HTMLVideoElement | null>(null)
  const state = ref<ScanState>('idle')

  let stream:   MediaStream | null = null
  let detector: Detector | null    = null
  let timer:    ReturnType<typeof setTimeout> | null = null

  async function start(): Promise<void> {
    if (!window.isSecureContext) { state.value = 'insecure'; return }
    if (!navigator.mediaDevices?.getUserMedia) { state.value = 'no-camera'; return }

    state.value = 'starting'
    try {
      const [s, d] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
        detector ? Promise.resolve(detector) : createDetector(),
      ])
      stream   = s
      detector = d
    } catch (e) {
      const name = (e as DOMException)?.name
      state.value =
        name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' :
        name === 'NotFoundError'   || name === 'OverconstrainedError' ? 'no-camera' :
        'error'
      stop(false)
      return
    }

    if (!video.value) { stop(); return }
    video.value.srcObject = stream
    await video.value.play().catch(() => {})
    state.value = 'scanning'
    tick()
  }

  async function tick(): Promise<void> {
    if (state.value !== 'scanning' || !detector || !video.value) return
    if (video.value.readyState >= 2) {
      try {
        const codes = await detector.detect(video.value)
        const hit   = codes.find((c) => c.rawValue?.trim())
        if (hit) {
          navigator.vibrate?.(60)
          state.value = 'paused'
          onCode(hit.rawValue.trim())
          return
        }
      } catch { /* quadro ruim, tenta o próximo */ }
    }
    timer = setTimeout(tick, 250)
  }

  // Depois de uma leitura a câmera fica ligada e pausada; volta a ler se o código era inválido
  function resume(): void {
    if (stream && state.value === 'paused') {
      state.value = 'scanning'
      tick()
    }
  }

  function stop(resetState = true): void {
    if (timer) { clearTimeout(timer); timer = null }
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    if (video.value) video.value.srcObject = null
    if (resetState) state.value = 'idle'
  }

  onBeforeUnmount(() => stop())

  return { video, state, start, stop, resume }
}
