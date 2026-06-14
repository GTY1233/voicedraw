import { useEffect, useRef } from 'react'
import { useApp } from '../store/appStore'
import Icon from './Icon'

export default function Transcript() {
  const log = useApp((s) => s.log)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight) }, [log])
  return (
    <div className="section">
      <div className="section-title"><Icon name="message" size={13} className="ic" />对话记录</div>
      <div className="log" ref={ref}>
        {log.length === 0 && (
          <div className="log-empty">
            <Icon name="message" size={22} className="ic" />
            你跟小绘说的话、小绘的回应，都会出现在这里～
          </div>
        )}
        {log.map((l, i) => (
          <div key={i} className={`log-row ${l.role}`}>
            <span className="av">
              <Icon name={l.role === 'user' ? 'user' : 'sparkles'} size={13} />
            </span>
            <span className="tx">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
