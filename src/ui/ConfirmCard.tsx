import { useApp } from '../store/appStore'
import Icon from './Icon'

// 对话式确认卡片：AI 在真正生图/改图前，先弹出确认问题，等用户语音确认
export default function ConfirmCard() {
  const pending = useApp((s) => s.pending)
  if (!pending) return null
  return (
    <div className="confirm-card">
      <div className="confirm-top">
        <span className="confirm-avatar">
          {/* 小熊「小绘」迷你头像（与 Assistant 一致的暖萌占位形象） */}
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="26" cy="24" r="13" fill="#E7A85B" stroke="#C9832F" strokeWidth="2" />
            <circle cx="74" cy="24" r="13" fill="#E7A85B" stroke="#C9832F" strokeWidth="2" />
            <circle cx="26" cy="24" r="6.5" fill="#FBE7C4" />
            <circle cx="74" cy="24" r="6.5" fill="#FBE7C4" />
            <circle cx="50" cy="56" r="33" fill="#E7A85B" stroke="#C9832F" strokeWidth="2" />
            <ellipse cx="50" cy="64" rx="19" ry="16" fill="#FBE7C4" />
            <circle cx="41" cy="52" r="4" fill="#5A3E1E" />
            <circle cx="59" cy="52" r="4" fill="#5A3E1E" />
            <ellipse cx="50" cy="60" rx="5" ry="3.6" fill="#5A3E1E" />
            <path d="M44 67 q6 5 12 0" fill="none" stroke="#5A3E1E" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="31" cy="62" rx="4.5" ry="3" fill="#F2A07B" opacity="0.55" />
            <ellipse cx="69" cy="62" rx="4.5" ry="3" fill="#F2A07B" opacity="0.55" />
          </svg>
        </span>
        <div>
          <div className="confirm-head">小绘等你确认 · {pending.kind === 'edit' ? '局部重绘' : '生成画面'}</div>
          <div className="confirm-name">说一声就好～</div>
        </div>
      </div>
      <div className="confirm-body">
        <div className="confirm-q">{pending.question}</div>
        <div className="confirm-actions">
          <span className="ca yes"><Icon name="check" size={14} />说「对」确认</span>
          <span className="ca edit"><Icon name="edit" size={14} />说出修改</span>
          <span className="ca no"><Icon name="cancel" size={14} />说「取消」</span>
        </div>
        <div className="confirm-mic"><Icon name="mic" size={13} />正在等待你的语音回复…</div>
      </div>
    </div>
  )
}
