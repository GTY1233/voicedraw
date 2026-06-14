import { useApp } from '../store/appStore'

type Status = 'idle' | 'listening' | 'thinking' | 'success' | 'error'

// 把内部信号收敛成五个状态：待命/聆听/思考/成功/出错
function useStatus(): Status {
  const { busy, listening, pending, log } = useApp()
  if (busy) return 'thinking'
  if (listening) return 'listening'
  const last = log[log.length - 1]
  if (!pending && last?.role === 'system') {
    if (/失败|错误|没太听懂|未|不支持|限流/.test(last.text)) return 'error'
    if (/画好了|改好了|已|成功|生成|完成|添加|切换/.test(last.text)) return 'success'
  }
  return 'idle'
}

const TAG: Record<Status, string> = {
  idle: '待命中', listening: '我在听～', thinking: '让我想想', success: '搞定啦', error: '没听清',
}

// 小熊「小绘」第一人称气泡——只表达「此刻」，不复读历史日志
function useMessage(status: Status): { text: string; typing: boolean } {
  const { pending, busy, listening } = useApp()
  if (pending) return { text: pending.question, typing: false }
  if (busy) return { text: '让我想想，正在帮你画', typing: true }
  if (listening) return { text: '我在听～说出你想画的内容吧', typing: false }
  if (status === 'success') return { text: '画好啦！还想画点什么？', typing: false }
  if (status === 'error') return { text: '哎呀，再说一次？换个说法也行～', typing: false }
  return { text: '嗨，今天想画点什么？点上面「开始语音」就能跟我说～', typing: false }
}

/* ────────────────────────────────────────────────────────────
   小熊「小绘」占位形象（暖萌圆润 SVG 小熊脸）。
   按状态切换神态：聆听张嘴、思考偏头、成功微笑、出错小窘。

   ★ 替换成真小熊立绘 PNG 的两种方式（任选其一）：
   1) 给 <Assistant bearImg="/bear.png" /> 传图片地址；或
   2) 在 :root 或 .app 上设置 CSS 变量  --bear-img: url('/bear.png');
   提供图片时自动用图片渲染，否则回退到下面的圆润占位小熊。
   ──────────────────────────────────────────────────────────── */
function BearFace({ status }: { status: Status }) {
  // 暖棕/蜂蜜橙配色
  const fur = '#E7A85B'
  const furDark = '#C9832F'
  const inner = '#FBE7C4'
  const ink = '#5A3E1E'
  // 神态参数
  const mouthOpen = status === 'listening'
  const browLift = status === 'thinking'
  const happy = status === 'success'
  const worried = status === 'error'

  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
      {/* 耳朵 */}
      <circle cx="26" cy="24" r="13" fill={fur} stroke={furDark} strokeWidth="2" />
      <circle cx="74" cy="24" r="13" fill={fur} stroke={furDark} strokeWidth="2" />
      <circle cx="26" cy="24" r="6.5" fill={inner} />
      <circle cx="74" cy="24" r="6.5" fill={inner} />
      {/* 脸 */}
      <circle cx="50" cy="56" r="33" fill={fur} stroke={furDark} strokeWidth="2" />
      {/* 口鼻区 */}
      <ellipse cx="50" cy="64" rx="19" ry="16" fill={inner} />
      {/* 眼睛（思考偏头时左眼微眯） */}
      {worried ? (
        <>
          <path d="M36 50 q5 -4 10 0" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M54 50 q5 -4 10 0" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="41" cy="52" r={happy ? 3.4 : 4} fill={ink} />
          <circle cx="59" cy="52" r={happy ? 3.4 : 4} fill={ink} />
          {/* 高光 */}
          <circle cx="42.4" cy="50.6" r="1.3" fill="#fff" />
          <circle cx="60.4" cy="50.6" r="1.3" fill="#fff" />
        </>
      )}
      {/* 眉毛（思考态上扬） */}
      {browLift && (
        <>
          <path d="M35 44 q6 -3 11 -1" fill="none" stroke={furDark} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M54 43 q5 -2 11 1" fill="none" stroke={furDark} strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {/* 鼻子 */}
      <ellipse cx="50" cy="60" rx="5" ry="3.6" fill={ink} />
      {/* 嘴：聆听张嘴 / 成功大笑 / 出错小撇 / 待命微笑 */}
      {mouthOpen ? (
        <ellipse cx="50" cy="70" rx="4.5" ry="5" fill={ink} />
      ) : happy ? (
        <path d="M42 67 q8 8 16 0" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      ) : worried ? (
        <path d="M44 71 q6 -4 12 0" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M44 67 q6 5 12 0" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      )}
      {/* 腮红（暖萌） */}
      <ellipse cx="31" cy="62" rx="4.5" ry="3" fill="#F2A07B" opacity="0.55" />
      <ellipse cx="69" cy="62" rx="4.5" ry="3" fill="#F2A07B" opacity="0.55" />
    </svg>
  )
}

// 状态 → 小熊动画：绘画(busy) / 画图成功(success) / 说话(聆听·确认) / 待机(其余)
function videoFor(status: Status, pending: boolean): 'idle' | 'talking' | 'drawing' | 'success' {
  if (status === 'thinking') return 'drawing'
  if (status === 'success') return 'success'
  if (status === 'listening' || pending) return 'talking'
  return 'idle'
}

export default function Assistant({ bearImg }: { bearImg?: string } = {}) {
  const status = useStatus()
  const { pending } = useApp()
  const { text, typing } = useMessage(status)

  // 默认用三段真小熊视频动画；若传了 bearImg 静态图则用图片
  const clip = videoFor(status, !!pending)

  return (
    <div className={`assistant assistant--${status}`} role="status" aria-live="polite">
      <div className="bear">
        {bearImg
          ? <img className="bear-img" src={bearImg} alt="小绘" />
          : <img className="bear-video" key={clip} src={`/bear/${clip}.webp`} alt="小绘" />}
      </div>
      <div className="bear-bubble">
        <div className="bear-name">小绘<span className="state-tag">{TAG[status]}</span></div>
        <div className="bear-say">
          {text}
          {typing && <span className="dots"><i /><i /><i /></span>}
        </div>
      </div>
    </div>
  )
}
