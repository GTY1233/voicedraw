import { useScene } from '../store/sceneStore'
import type { Shape, StyleFilter } from './types'

export const CANVAS_W = 1000
export const CANVAS_H = 700

const center = (s: Shape): [number, number] => {
  switch (s.type) {
    case 'line':
    case 'arrow':
      return [((s.x + (s.x2 ?? s.x)) / 2), ((s.y + (s.y2 ?? s.y)) / 2)]
    case 'text':
      return [s.x, s.y - (s.fontSize ?? 28) / 2]
    default:
      return [s.x + (s.w ?? 0) / 2, s.y + (s.h ?? 0) / 2]
  }
}

function ShapeNode({ s }: { s: Shape }) {
  const [cx, cy] = center(s)
  const transform = s.rotation ? `rotate(${s.rotation} ${cx} ${cy})` : undefined
  const common = { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, transform }

  switch (s.type) {
    case 'rect':
      return <rect x={s.x} y={s.y} width={s.w} height={s.h} {...common} />
    case 'roundrect':
      return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={16} ry={16} {...common} />
    case 'ellipse':
      return <ellipse cx={s.x + (s.w ?? 0) / 2} cy={s.y + (s.h ?? 0) / 2} rx={(s.w ?? 0) / 2} ry={(s.h ?? 0) / 2} {...common} />
    case 'diamond': {
      const x = s.x, y = s.y, w = s.w ?? 0, h = s.h ?? 0
      const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`
      return <polygon points={pts} {...common} />
    }
    case 'triangle': {
      const x = s.x, y = s.y, w = s.w ?? 0, h = s.h ?? 0
      const pts = `${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`
      return <polygon points={pts} {...common} />
    }
    case 'line':
      return <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} transform={transform} />
    case 'arrow':
      return s.points
        ? <polyline points={s.points} fill="none" stroke={s.stroke} strokeWidth={s.strokeWidth} markerEnd="url(#arrowhead)" />
        : <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} markerEnd="url(#arrowhead)" transform={transform} />
    case 'text': {
      const fs = s.fontSize ?? 28
      const lines = (s.text ?? '').split('\n')
      const startDy = -((lines.length - 1) * fs * 1.15) / 2
      return (
        <text x={s.x} y={s.y} fontSize={fs} fill={s.fill} transform={transform}
          fontFamily="system-ui, -apple-system, 'Microsoft YaHei', sans-serif" dominantBaseline="middle" textAnchor="middle"
          fontWeight={600}>
          {lines.map((ln, i) => (
            <tspan key={i} x={s.x} dy={i === 0 ? startDy : fs * 1.15}>{ln}</tspan>
          ))}
        </text>
      )
    }
    case 'image':
      return <image href={s.href} x={s.x} y={s.y} width={s.w} height={s.h} transform={transform} preserveAspectRatio="xMidYMid slice" />
    default:
      return null
  }
}

// 选中描边框
function SelectionBox({ s }: { s: Shape }) {
  let x = s.x, y = s.y, w = s.w ?? 0, h = s.h ?? 0
  if (s.type === 'line' || s.type === 'arrow') {
    x = Math.min(s.x, s.x2 ?? s.x); y = Math.min(s.y, s.y2 ?? s.y)
    w = Math.abs((s.x2 ?? s.x) - s.x); h = Math.abs((s.y2 ?? s.y) - s.y)
  } else if (s.type === 'text') {
    const fs = s.fontSize ?? 28; const tw = (s.text?.length ?? 1) * fs
    x = s.x - tw / 2; y = s.y - fs / 2; w = tw; h = fs
  }
  const pad = 8
  return <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2}
    fill="none" stroke="#EF9F27" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
}

const filterId = (f: StyleFilter) => (f ? `style-${f}` : undefined)

function StyleFilters() {
  return (
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <polygon points="0 0, 10 4, 0 8" fill="context-stroke" />
      </marker>

      {/* 点阵网格背景（空画布时，暖色） */}
      <pattern id="dotgrid" width="26" height="26" patternUnits="userSpaceOnUse">
        <circle cx="1.4" cy="1.4" r="1.4" fill="#F0E7D8" />
      </pattern>

      {/* 水彩：噪声位移 + 轻微模糊 */}
      <filter id="style-watercolor">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
        <feGaussianBlur stdDeviation="0.6" />
      </filter>

      {/* 手绘：边缘轻抖动 */}
      <filter id="style-sketch">
        <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="2" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
      </filter>

      {/* 霓虹：发光 */}
      <filter id="style-neon" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* 复古：色阶分层（近似像素/海报化）*/}
      <filter id="style-pixel">
        <feComponentTransfer>
          <feFuncR type="discrete" tableValues="0 0.33 0.66 1" />
          <feFuncG type="discrete" tableValues="0 0.33 0.66 1" />
          <feFuncB type="discrete" tableValues="0 0.33 0.66 1" />
        </feComponentTransfer>
      </filter>

      {/* 黑白 */}
      <filter id="style-mono">
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
  )
}

export default function SceneSvg() {
  const { nodes, selectedId, background, styleFilter } = useScene()
  const selected = nodes.find((n) => n.id === selectedId)

  return (
    <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="scene-svg" preserveAspectRatio="xMidYMid meet">
      <StyleFilters />
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#FFFDFA" />
      {!background && <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#dotgrid)" />}
      {background && (
        <image key={background.slice(-24)} className="reveal" href={background} x={0} y={0} width={CANVAS_W} height={CANVAS_H} preserveAspectRatio="xMidYMid slice" />
      )}
      <g filter={filterId(styleFilter) ? `url(#${filterId(styleFilter)})` : undefined}>
        {nodes.map((s) => <ShapeNode key={s.id} s={s} />)}
      </g>
      {selected && <SelectionBox s={selected} />}
    </svg>
  )
}
