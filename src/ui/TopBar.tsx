import { useApp } from '../store/appStore'
import Icon from './Icon'

export default function TopBar() {
  const { mode, listening, setMode, pushLog } = useApp()
  const switchTo = (m: 'efficiency' | 'creative') => {
    if (m === mode) return
    setMode(m)
    pushLog('system', m === 'creative' ? '已切换到创意模式' : '已回到效率模式')
  }
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo"><Icon name="mic" size={16} /></span>
        <span className="name">VoiceDraw</span>
        <span className="sub">和小绘一起，说着说着就画好了</span>
      </div>

      <div className="segmented">
        <button className={mode === 'efficiency' ? 'on' : ''} onClick={() => switchTo('efficiency')}>
          <Icon name="zap" size={15} />效率模式
        </button>
        <button className={mode === 'creative' ? 'on' : ''} onClick={() => switchTo('creative')}>
          <Icon name="sparkles" size={15} />创意模式
        </button>
      </div>

      <div className="topbar-right">
        <div className={`listen-dot ${listening ? 'live' : ''}`}>
          <span className="d" />{listening ? '正在聆听' : '待命中'}
        </div>
      </div>
    </header>
  )
}
