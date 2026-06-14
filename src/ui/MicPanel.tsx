import type { ReactNode } from 'react'
import { useApp } from '../store/appStore'
import Icon from './Icon'

export default function MicPanel({ onToggle, children }: { onToggle: () => void; children?: ReactNode }) {
  const { listening, mode, asrEnabled } = useApp()
  const noMic = !asrEnabled
  return (
    <div className="mic-section">
      <button
        className={`mic-btn ${listening ? 'live' : ''}`}
        onClick={onToggle}
        disabled={noMic}
        aria-pressed={listening}
      >
        {listening ? (
          <>
            <span className="wave"><i /><i /><i /><i /></span>
            正在聆听 · 点此停止
          </>
        ) : (
          <><Icon name="mic" size={18} /> 开始语音</>
        )}
      </button>
      <div className="mic-hint">
        {noMic
          ? <>云端语音未配置，可用下方文字指令</>
          : listening
            ? '说出指令，停顿后自动执行'
            : <>例如{mode === 'creative' ? '「画一幅雪山日出」' : '「画一个红色的圆」'}</>}
      </div>
      {children}
    </div>
  )
}
