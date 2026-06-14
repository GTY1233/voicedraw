// 图表自动排版：用 dagre 算坐标，再生成专业观感的 Shape（流程图 / 组织架构图 / 思维导图）。
import dagre from '@dagrejs/dagre'
import { newId } from '../store/sceneStore'
import type { Shape, ShapeType } from './types'

export type DiagramKind = 'flow' | 'org' | 'tree' | 'mindmap'

export interface GraphNode { id: string; label: string; shape?: 'start' | 'process' | 'decision' | 'end' }
export interface GraphEdge { from: string; to: string; label?: string }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[]; direction?: 'TB' | 'LR' }

const FONT = 17
const LINE_H = 21
const PAD_X = 20
const PAD_Y = 14
const MAX_PER_LINE = 7 // 每行最多字符（中文）

// 文字换行
function wrap(label: string): string[] {
  const t = (label || '').trim()
  if (!t) return ['']
  if (t.length <= MAX_PER_LINE) return [t]
  const lines: string[] = []
  let s = t
  while (s.length > MAX_PER_LINE) { lines.push(s.slice(0, MAX_PER_LINE)); s = s.slice(MAX_PER_LINE) }
  if (s) lines.push(s)
  return lines.slice(0, 3) // 最多 3 行
}

function nodeSize(label: string, shape?: string) {
  const lines = wrap(label)
  const longest = Math.max(...lines.map((l) => l.length), 2)
  let w = Math.max(124, Math.min(248, longest * FONT + PAD_X * 2))
  let h = lines.length * LINE_H + PAD_Y * 2
  if (shape === 'decision') { w = Math.round(w * 1.35); h = Math.round(h * 1.5) } // 菱形需更大
  return { w, h, lines }
}

// 配色（流程图）
const FLOW_STYLE: Record<string, { type: ShapeType; fill: string; stroke: string }> = {
  start: { type: 'roundrect', fill: '#dcfce7', stroke: '#16a34a' },
  end: { type: 'roundrect', fill: '#dcfce7', stroke: '#16a34a' },
  decision: { type: 'diamond', fill: '#fef3c7', stroke: '#d97706' },
  process: { type: 'rect', fill: '#dbeafe', stroke: '#2563eb' },
}

export function layoutGraph(g: Graph, kind: DiagramKind = 'flow'): Shape[] {
  const G = new dagre.graphlib.Graph()
  G.setGraph({
    rankdir: g.direction || (kind === 'mindmap' ? 'LR' : 'TB'),
    nodesep: 42, ranksep: 64, edgesep: 24, marginx: 36, marginy: 36, ranker: 'tight-tree',
  })
  G.setDefaultEdgeLabel(() => ({}))

  const sizeById = new Map<string, { w: number; h: number; lines: string[] }>()
  for (const n of g.nodes) {
    const sz = nodeSize(n.label, n.shape)
    sizeById.set(n.id, sz)
    G.setNode(n.id, { width: sz.w, height: sz.h })
  }
  for (const e of g.edges) G.setEdge(e.from, e.to)
  dagre.layout(G)

  // 根节点（无入边）用于层级图高亮
  const hasIncoming = new Set(g.edges.map((e) => e.to))
  const out: Shape[] = []

  // 节点
  for (const n of g.nodes) {
    const pos = G.node(n.id); const sz = sizeById.get(n.id)
    if (!pos || !sz) continue
    const w = pos.width, h = pos.height, x = pos.x - w / 2, y = pos.y - h / 2

    let type: ShapeType = 'roundrect', fill = '#dbeafe', stroke = '#2563eb'
    if (kind === 'flow') {
      const st = FLOW_STYLE[n.shape || 'process'] || FLOW_STYLE.process
      type = st.type; fill = st.fill; stroke = st.stroke
    } else {
      // 组织架构 / 树 / 脑图：根节点强调色，其余统一
      const isRoot = !hasIncoming.has(n.id)
      type = 'roundrect'
      fill = isRoot ? '#2563eb' : '#eff6ff'
      stroke = isRoot ? '#1e40af' : '#93c5fd'
    }
    out.push({ id: 'node_' + n.id, type, x, y, w, h, fill, stroke, strokeWidth: 2, rotation: 0 })

    const isRootDark = kind !== 'flow' && !hasIncoming.has(n.id)
    out.push({
      id: 'lbl_' + n.id, type: 'text', x: pos.x, y: pos.y,
      text: sz.lines.join('\n'), fontSize: FONT,
      fill: isRootDark ? '#ffffff' : '#0f2747', stroke: 'none', strokeWidth: 0, rotation: 0,
    })
  }

  // 连线（用 dagre 折线路径，不穿节点）
  for (const e of g.edges) {
    const a = G.node(e.from), b = G.node(e.to)
    if (!a || !b) continue
    const ed: any = G.edge(e.from, e.to)
    const pts = ed?.points?.length ? ed.points : [{ x: a.x, y: a.y + a.height / 2 }, { x: b.x, y: b.y - b.height / 2 }]
    const pstr = pts.map((p: any) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    out.push({
      id: newId(), type: 'arrow', points: pstr,
      x: pts[0].x, y: pts[0].y, x2: pts[pts.length - 1].x, y2: pts[pts.length - 1].y,
      fill: 'none', stroke: '#94a3b8', strokeWidth: 2, rotation: 0,
    })
    if (e.label) {
      const mid = pts[Math.floor(pts.length / 2)]
      const lw = e.label.length * 15 + 10
      // 白底，避免标签被连线/节点遮挡
      out.push({ id: newId(), type: 'roundrect', x: mid.x - lw / 2, y: mid.y - 13, w: lw, h: 24, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1, rotation: 0 })
      out.push({ id: newId(), type: 'text', x: mid.x, y: mid.y, text: e.label, fontSize: 14, fill: '#b45309', stroke: 'none', strokeWidth: 0, rotation: 0 })
    }
  }
  return fitToCanvas(out)
}

// 把整张图等比缩放并居中到画布内，保证任何规模的图表都完整可见
const CW = 1000, CH = 700, FIT_MARGIN = 28
function fitToCanvas(shapes: Shape[]): Shape[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const acc = (x: number, y: number) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
  for (const s of shapes) {
    if (s.points) s.points.split(' ').forEach((p) => { const [a, b] = p.split(',').map(Number); acc(a, b) })
    else if (s.type === 'line' || s.type === 'arrow') { acc(s.x, s.y); acc(s.x2 ?? s.x, s.y2 ?? s.y) }
    else if (s.type === 'text') { const w = (s.text?.split('\n').reduce((m, l) => Math.max(m, l.length), 0) || 1) * (s.fontSize || 16); const fs = s.fontSize || 16; acc(s.x - w / 2, s.y - fs); acc(s.x + w / 2, s.y + fs) }
    else { acc(s.x, s.y); acc(s.x + (s.w || 0), s.y + (s.h || 0)) }
  }
  const bw = maxX - minX, bh = maxY - minY
  if (!isFinite(bw) || !isFinite(bh) || bw <= 0 || bh <= 0) return shapes
  const scale = Math.min(1, (CW - 2 * FIT_MARGIN) / bw, (CH - 2 * FIT_MARGIN) / bh)
  const offX = (CW - bw * scale) / 2 - minX * scale
  const offY = (CH - bh * scale) / 2 - minY * scale
  const tx = (x: number) => x * scale + offX
  const ty = (y: number) => y * scale + offY
  for (const s of shapes) {
    if (s.points) s.points = s.points.split(' ').map((p) => { const [a, b] = p.split(',').map(Number); return `${tx(a).toFixed(1)},${ty(b).toFixed(1)}` }).join(' ')
    if (s.x2 != null) s.x2 = tx(s.x2)
    if (s.y2 != null) s.y2 = ty(s.y2)
    s.x = tx(s.x); s.y = ty(s.y)
    if (s.w != null) s.w *= scale
    if (s.h != null) s.h *= scale
    if (s.fontSize != null) s.fontSize = Math.max(11, s.fontSize * scale)
  }
  return shapes
}
