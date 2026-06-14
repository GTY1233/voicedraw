import { useEffect, useRef, useState } from 'react'
import TopBar from './ui/TopBar'
import CanvasStage from './ui/CanvasStage'
import MicPanel from './ui/MicPanel'
import Assistant from './ui/Assistant'
import EfficiencyPanel from './ui/EfficiencyPanel'
import CreativePanel from './ui/CreativePanel'
import Transcript from './ui/Transcript'
import CostMeter from './ui/CostMeter'
import Icon from './ui/Icon'
import { CloudASR } from './voice/cloudAsr'
import { handleUtterance } from './commands/router'
import { useApp } from './store/appStore'
import { getConfig } from './api/client'

export default function App() {
  const { mode, toast, asrEnabled, setListening, setInterim, setImageEnabled, setAsrEnabled, pushLog } = useApp()
  const asrRef = useRef<CloudASR | null>(null)
  const finalBuf = useRef('') // 累积已识别的整句
  const finalTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    getConfig().then((c) => { setImageEnabled(c.imageEnabled); setAsrEnabled(c.asrEnabled) }).catch(() => {})
    asrRef.current = new CloudASR({
      // 实时字幕：已确定的整句 + 当前正在识别的片段
      onInterim: (t) => setInterim((finalBuf.current ? finalBuf.current + ' ' : '') + t),
      // 关键：把"换气微停顿"被拆成的多段，合并成一条完整指令再执行（去抖 0.9s）
      onFinal: (t) => {
        const piece = t.trim()
        if (!piece) return
        if (!finalBuf.current.endsWith(piece)) finalBuf.current = (finalBuf.current + ' ' + piece).trim()
        setInterim(finalBuf.current)
        if (finalTimer.current) clearTimeout(finalTimer.current)
        finalTimer.current = setTimeout(() => {
          const full = finalBuf.current.trim(); finalBuf.current = ''; setInterim('')
          if (full) handleUtterance(full)
        }, 900)
      },
      onState: setListening,
      onError: (m) => pushLog('system', m),
    })
  }, [])

  const toggleMic = () => {
    if (!asrEnabled) {
      pushLog('system', '云端语音识别未配置：请在 .env 填入 DASHSCOPE_API_KEY 并重启后端；当前可用下方文字指令输入')
      return
    }
    asrRef.current?.toggle()
  }

  const submitDraft = () => { const t = draft.trim(); if (!t) return; setDraft(''); handleUtterance(t) }

  return (
    <div className={`app ${mode === 'creative' ? 'creative-theme' : ''}`}>
      <TopBar />
      <div className="stage">
        <div className="canvas-col">
          <CanvasStage />
        </div>

        <aside className="panel">
          <div className="panel-scroll">
            {/* 状态：克制的状态指示器 */}
            <Assistant />

            {/* 主操作：语音；下方为低调的无麦文字次要入口 */}
            <MicPanel onToggle={toggleMic}>
              <div className="debug">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
                  aria-label="文字指令输入"
                  placeholder="没有麦克风？输入文字指令" />
                <button onClick={submitDraft} aria-label="发送指令"><Icon name="send" size={15} /></button>
              </div>
            </MicPanel>

            {/* 当前模式的上下文内容 */}
            {mode === 'creative' ? <CreativePanel /> : <EfficiencyPanel />}
            <Transcript />

            {/* 弱化的 meta：成本仪表盘，贴底 */}
            <CostMeter />
          </div>
        </aside>
      </div>
      {toast && <div className="toast"><Icon name="check" size={15} className="ic" />{toast}</div>}
    </div>
  )
}
