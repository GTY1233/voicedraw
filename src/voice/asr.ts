// Web Speech 识别封装：中文连续识别 + 实时中间结果 + 自动重启（静音/异常兜底）。
type Handlers = {
  onInterim?: (text: string) => void
  onFinal?: (text: string) => void
  onState?: (listening: boolean) => void
  onError?: (msg: string) => void
}

// 浏览器前缀兼容
const SR: any =
  (typeof window !== 'undefined') &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

// 致命错误：不应自动重启（否则会无限刷屏）
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])

export class ASR {
  private rec: any = null
  private wantOn = false
  private h: Handlers
  supported = !!SR

  constructor(h: Handlers) { this.h = h }

  start() {
    if (!this.supported) { this.h.onError?.('当前浏览器不支持语音识别，请用 Chrome/Edge'); return }
    this.wantOn = true
    this._spin()
    this.h.onState?.(true)
  }

  stop() {
    this.wantOn = false
    try { this.rec?.stop() } catch {}
    this.h.onState?.(false)
  }

  toggle() { this.wantOn ? this.stop() : this.start() }

  private _spin() {
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.h.onFinal?.(r[0].transcript.trim())
        else interim += r[0].transcript
      }
      if (interim) this.h.onInterim?.(interim.trim())
    }
    rec.onerror = (e: any) => {
      const err = e.error
      if (err === 'no-speech' || err === 'aborted') return // 无害，靠 onend 重启
      if (FATAL.has(err)) {
        this.wantOn = false // 致命错误：停止自动重启，避免死循环刷屏
        this.h.onError?.(
          err === 'audio-capture'
            ? '未检测到麦克风设备，请插入麦克风后重试'
            : '麦克风未授权。请用 Chrome 直接打开 http://localhost:5173 并允许麦克风（嵌入式预览面板通常不支持麦克风）'
        )
        this.h.onState?.(false)
        return
      }
      this.h.onError?.('语音识别错误：' + err)
    }
    rec.onend = () => {
      if (this.wantOn) { try { rec.start() } catch {} } // 自动重启实现"持续免手"
      else this.h.onState?.(false)
    }
    this.rec = rec
    try { rec.start() } catch {}
  }
}
