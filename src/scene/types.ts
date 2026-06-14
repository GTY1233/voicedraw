// 场景图：整个画布就是一个 Shape 数组（矢量），外加一张可选的 AI 背景位图。
// 统一用一个相对宽松的结构，便于本地引擎与 LLM 都能产出。

export type ShapeType =
  | 'rect'
  | 'roundrect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'diamond'
  | 'text'
  | 'image'

export interface Shape {
  id: string
  type: ShapeType
  // rect/roundrect/ellipse/diamond/image：(x,y) 为左上角；triangle 同；line/arrow：(x,y)->(x2,y2)
  x: number
  y: number
  w?: number
  h?: number
  x2?: number
  y2?: number
  points?: string // arrow 折线路径（流程图连线，避免穿过节点）
  text?: string // text 节点的文字 / 组件标签
  fontSize?: number
  fill: string
  stroke: string
  strokeWidth: number
  rotation: number // 角度，绕自身中心
  href?: string // image 节点的 dataURI
  role?: 'node' | 'edge' | 'component' // 流程图/线框图语义（可选）
}

export type StyleFilter =
  | null
  | 'watercolor'
  | 'sketch'
  | 'neon'
  | 'pixel'
  | 'mono'

export interface Snapshot {
  nodes: Shape[]
  background: string | null
  styleFilter: StyleFilter
}

// 颜色中文名 → 十六进制
export const COLORS: Record<string, string> = {
  红: '#e23b3b', 红色: '#e23b3b', 橙: '#f08c2e', 橙色: '#f08c2e',
  黄: '#f5c518', 黄色: '#f5c518', 绿: '#3aa757', 绿色: '#3aa757',
  青: '#1abc9c', 蓝: '#2d7ff9', 蓝色: '#2d7ff9', 紫: '#8e44ad', 紫色: '#8e44ad',
  粉: '#ff6fae', 粉色: '#ff6fae', 黑: '#222222', 黑色: '#222222',
  白: '#ffffff', 白色: '#ffffff', 灰: '#9aa0a6', 灰色: '#9aa0a6',
  浅灰: '#e7e9ec', 深灰: '#5f6368', 棕: '#8b5a2b', 金: '#d4af37',
}
