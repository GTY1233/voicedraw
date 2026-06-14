import { useScene } from '../store/sceneStore'
import { useApp } from '../store/appStore'
import Icon from './Icon'
import type { StyleFilter } from '../scene/types'

const STYLES: { f: StyleFilter; name: string; sw: string }[] = [
  { f: null, name: '原始', sw: 'linear-gradient(135deg,#FBE3D0,#F6B24E)' },
  { f: 'watercolor', name: '水彩', sw: 'linear-gradient(135deg,#9fd6e8,#f7c6d9)' },
  { f: 'sketch', name: '手绘', sw: 'repeating-linear-gradient(45deg,#F0E7D8,#F0E7D8 3px,#FFFDFA 3px,#FFFDFA 6px)' },
  { f: 'neon', name: '霓虹', sw: 'linear-gradient(135deg,#7c5cff,#19e0c8)' },
  { f: 'pixel', name: '复古', sw: 'linear-gradient(135deg,#f5c518,#e9a23b)' },
  { f: 'mono', name: '黑白', sw: 'linear-gradient(135deg,#3a3f47,#aeb4bd)' },
]

export default function StyleSelector() {
  const { styleFilter, setStyle } = useScene()
  const pushLog = useApp((s) => s.pushLog)
  return (
    <div className="styles">
      {STYLES.map((s) => (
        <button key={s.name} className={`style-cell ${styleFilter === s.f ? 'on' : ''}`}
          onClick={() => { setStyle(s.f); pushLog('system', s.f ? `已切换为${s.name}风格` : '已恢复原始风格') }}>
          {styleFilter === s.f && <span className="tick"><Icon name="check" size={10} /></span>}
          <div className="sw" style={{ background: s.sw }} />
          {s.name}
        </button>
      ))}
    </div>
  )
}
