// 国内云流式 ASR（阿里 DashScope paraformer-realtime）客户端。
// 浏览器采集麦克风 → 16k/16bit/单声道 PCM → WebSocket 流式发到本地后端代理 → 实时逐字字幕。
type Handlers = {
  onInterim?: (text: string) => void
  onFinal?: (text: string) => void
  onState?: (listening: boolean) => void
  onError?: (msg: string) => void
}

const wsUrl = () => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/asr`
}

export class CloudASR {
  private ws: WebSocket | null = null
  private ctx: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private running = false
  private h: Handlers
  supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  constructor(h: Handlers) { this.h = h }

  async start() {
    if (this.running) return
    if (!this.supported) { this.h.onError?.('当前环境不支持麦克风'); return }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch {
      this.h.onError?.('麦克风未授权：请用 Chrome 打开并允许麦克风权限'); return
    }

    this.ws = new WebSocket(wsUrl())
    this.ws.binaryType = 'arraybuffer'
    this.ws.onopen = () => { this.running = true; this.h.onState?.(true); this._startCapture() }
    this.ws.onmessage = (ev) => {
      let m: any; try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'result') {
        if (m.isFinal) { if (m.text?.trim()) this.h.onFinal?.(m.text.trim()) }
        else this.h.onInterim?.(m.text || '')
      } else if (m.type === 'error') {
        this.h.onError?.(m.message || '语音识别出错'); this.stop()
      }
    }
    this.ws.onerror = () => this.h.onError?.('语音连接出错，请检查后端是否运行')
    this.ws.onclose = () => { if (this.running) { this.running = false; this.h.onState?.(false) } }
  }

  private _startCapture() {
    if (!this.stream) return
    this.ctx = new AudioContext()
    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    const inRate = this.ctx.sampleRate
    this.processor.onaudioprocess = (e) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      const buf = downsampleTo16k(e.inputBuffer.getChannelData(0), inRate)
      if (buf.byteLength) this.ws.send(buf)
    }
    this.source.connect(this.processor)
    this.processor.connect(this.ctx.destination) // 某些浏览器需连到 destination 才触发 onaudioprocess
  }

  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ action: 'finish' })) } catch {}
    }
    this.running = false
    try { this.processor?.disconnect() } catch {}
    try { this.source?.disconnect() } catch {}
    try { this.ctx?.close() } catch {}
    try { this.stream?.getTracks().forEach((t) => t.stop()) } catch {}
    const ws = this.ws
    setTimeout(() => { try { ws?.close() } catch {} }, 400) // 留时间把 finish 与尾句刷完
    this.ws = null; this.ctx = null; this.processor = null; this.source = null; this.stream = null
    this.h.onState?.(false)
  }

  toggle() { this.running ? this.stop() : this.start() }
}

function downsampleTo16k(input: Float32Array, inRate: number): ArrayBuffer {
  const outRate = 16000
  if (inRate === outRate) return floatToInt16(input)
  const ratio = inRate / outRate
  const outLen = Math.floor(input.length / ratio)
  const out = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0, c = 0
    for (let j = start; j < end; j++) { sum += input[j]; c++ }
    const v = c ? sum / c : (input[start] || 0)
    out[i] = Math.max(-1, Math.min(1, v)) * 0x7fff
  }
  return out.buffer
}
function floatToInt16(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) out[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff
  return out.buffer
}
