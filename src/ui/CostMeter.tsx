import { useEffect, useState } from 'react'
import { getStats } from '../api/client'
import Icon from './Icon'

// 端云成本：属 meta 信息，弱化为可收起的贴底条，默认收起。
export default function CostMeter() {
  const [s, setS] = useState<any>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const tick = () => getStats().then(setS).catch(() => {})
    tick(); const t = setInterval(tick, 3000); return () => clearInterval(t)
  }, [])
  if (!s) return null
  return (
    <div className="panel-meta">
      <button className="cost-bar" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="coins" size={14} className="ic" />
        端云成本
        <span className="cost-amt">¥{s.estCostRMB.toFixed(2)}</span>
        <Icon name="chevron" size={14} className="chev" />
      </button>
      {open && (
        <div className="cost-detail">
          <div className="cost-grid">
            <div className="cost-cell"><div className="n">{s.genCalls}</div><div className="l">文生图</div></div>
            <div className="cost-cell"><div className="n">{s.editCalls}</div><div className="l">局部重绘</div></div>
            <div className="cost-cell"><div className="n">{s.nluCalls}</div><div className="l">语义理解</div></div>
            <div className="cost-cell"><div className="n">{s.cacheHits}</div><div className="l">缓存命中</div></div>
          </div>
          <div className="cost-foot">
            <span>云端累计 ¥{s.estCostRMB.toFixed(2)}</span>
            <span className="free"><Icon name="check" size={12} />本地指令 0 成本</span>
          </div>
        </div>
      )}
    </div>
  )
}
