// 本地规则引擎：覆盖高频原子指令，<5ms 出结果，0 成本、0 网络。
// 命中返回 ParseResult；未命中返回 null（交给 LLM 兜底）。
import { COLORS } from '../scene/types'
import type { ShapeType, StyleFilter } from '../scene/types'
import type { Action, ParseResult } from './types'

const pickColor = (t: string): string | null => {
  const keys = Object.keys(COLORS).sort((a, b) => b.length - a.length)
  for (const k of keys) if (t.includes(k)) return COLORS[k]
  return null
}

const CN: Record<string, number> = { 零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
const pickNumber = (t: string): number | null => {
  const m = t.match(/(\d+(\.\d+)?)/)
  if (m) return parseFloat(m[1])
  for (const k in CN) if (t.includes(k)) return CN[k]
  return null
}

const SHAPES: { re: RegExp; type: ShapeType; w: number; h: number; name: string }[] = [
  { re: /(圆形|圆圈|画个圆|圆(?!角))/, type: 'ellipse', w: 160, h: 160, name: '圆' },
  { re: /椭圆/, type: 'ellipse', w: 220, h: 140, name: '椭圆' },
  { re: /(圆角矩形|圆角)/, type: 'roundrect', w: 220, h: 120, name: '圆角矩形' },
  { re: /(正方形|方块)/, type: 'rect', w: 160, h: 160, name: '正方形' },
  { re: /(矩形|长方形|方框)/, type: 'rect', w: 220, h: 140, name: '矩形' },
  { re: /(菱形|判断框|决策)/, type: 'diamond', w: 190, h: 120, name: '菱形' },
  { re: /(三角形|三角)/, type: 'triangle', w: 190, h: 165, name: '三角形' },
  { re: /(箭头)/, type: 'arrow', w: 200, h: 0, name: '箭头' },
  { re: /(直线|线条|画条线|画线)/, type: 'line', w: 200, h: 0, name: '线条' },
]

// 级联落点（未指定方位时），避免新图形叠在一起
let dropIdx = 0
const dropPoint = () => {
  const cols = 4
  const i = dropIdx++ % 12
  return [260 + (i % cols) * 180, 200 + Math.floor(i / cols) * 170] as const
}

// 方位词 → 画布落点（画布 1000x700）
const POS: { re: RegExp; xy: readonly [number, number]; name: string }[] = [
  { re: /(左上)/, xy: [250, 180], name: '左上角' },
  { re: /(右上)/, xy: [750, 180], name: '右上角' },
  { re: /(左下)/, xy: [250, 520], name: '左下角' },
  { re: /(右下)/, xy: [750, 520], name: '右下角' },
  { re: /(中间|中央|正中|居中|中心)/, xy: [500, 350], name: '中间' },
]
const pickPosition = (t: string): readonly [number, number] | null => {
  for (const p of POS) if (p.re.test(t)) return p.xy
  let x: number | null = null, y: number | null = null
  if (/(左边|左侧|左面|靠左|偏左|左方|最左)/.test(t)) x = 250
  if (/(右边|右侧|右面|靠右|偏右|右方|最右)/.test(t)) x = 750
  if (/(上边|上面|上方|顶部|靠上|偏上)/.test(t)) y = 180
  if (/(下边|下面|下方|底部|靠下|偏下)/.test(t)) y = 520
  if (x == null && y == null) return null
  return [x ?? 500, y ?? 350] as const
}
const positionLabel = (t: string): string => {
  for (const p of POS) if (p.re.test(t)) return p.name
  if (/(左边|左侧|左面|靠左|偏左|左方|最左)/.test(t)) return '左边'
  if (/(右边|右侧|右面|靠右|偏右|右方|最右)/.test(t)) return '右边'
  if (/(上边|上面|上方|顶部|靠上|偏上)/.test(t)) return '上方'
  if (/(下边|下面|下方|底部|靠下|偏下)/.test(t)) return '下方'
  return ''
}

const STYLE_MAP: { re: RegExp; f: StyleFilter; name: string }[] = [
  { re: /(水彩)/, f: 'watercolor', name: '水彩' },
  { re: /(手绘|素描|铅笔)/, f: 'sketch', name: '手绘' },
  { re: /(霓虹|发光|赛博)/, f: 'neon', name: '霓虹' },
  { re: /(复古|像素|海报)/, f: 'pixel', name: '复古' },
  { re: /(黑白|灰度|单色)/, f: 'mono', name: '黑白' },
]

const colorName = (t: string): string => {
  const keys = Object.keys(COLORS).sort((a, b) => b.length - a.length)
  for (const k of keys) if (t.includes(k)) return k.replace('色', '') + '色'
  return ''
}

export function parseLocal(raw: string): ParseResult | null {
  const t = raw.trim()
  if (!t) return null

  // —— 控制类 ——
  if (/(撤销|回退|撤回|后退一步)/.test(t)) return { actions: [{ kind: 'undo' }], say: '已撤销' }
  if (/(重做|恢复刚才|前进一步)/.test(t)) return { actions: [{ kind: 'redo' }], say: '已重做' }
  if (/(清空|清除画布|全部删除|全部清掉|重新开始)/.test(t)) return { actions: [{ kind: 'clear' }], say: '画布已清空' }
  if (/(删除|删掉|去掉这个|擦掉)/.test(t) && !/风格/.test(t)) return { actions: [{ kind: 'delete' }], say: '已删除' }

  // —— 风格滤镜 ——
  if (/(去掉风格|取消风格|恢复原样|无风格)/.test(t)) return { actions: [{ kind: 'style', filter: null }], say: '已恢复原始风格' }
  for (const s of STYLE_MAP) {
    if (s.re.test(t) && /(风格|滤镜|切换|变为|换成|改成|用)/.test(t)) {
      return { actions: [{ kind: 'style', filter: s.f }], say: `已切换为${s.name}风格` }
    }
  }

  // —— 背景色 ——
  if (/背景/.test(t)) { const c = pickColor(t); if (c) return { actions: [{ kind: 'bgColor', color: c }], say: '背景已更新' } }

  const hit = SHAPES.find((s) => s.re.test(t))
  const drawVerb = /(画|添加|创建|画出|新增|来一?个|加一?个|放一?个|换一?个)/.test(t)
  const transformVerb = /(移|挪|旋转|转(?!换)|放大|缩小|大一点|大一些|大点|变大|小一点|小一些|小点|变小)/.test(t)

  // —— 文字（先于形状）——
  const textM = t.match(/(?:写|文字|文本|标签|写上|写个)[：:]?\s*(.+)$/)
  if (textM && /(写|文字|文本|标签)/.test(t) && !hit) {
    const content = textM[1].replace(/[，。,.]$/, '').trim() || '文字'
    const [cx, cy] = pickPosition(t) ?? dropPoint()
    const color = pickColor(t) || '#222222'
    return { actions: [{ kind: 'add', shape: { type: 'text', x: cx, y: cy, text: content, fontSize: 36, fill: color, stroke: 'none', strokeWidth: 0 } }], say: `已添加文字「${content}」` }
  }

  // —— 画形状（优先于变换；方位词作落点，不再被当成移动）——
  if (hit && (drawVerb || !transformVerb)) {
    const [cx, cy] = pickPosition(t) ?? dropPoint()
    const color = pickColor(t)
    const pos = positionLabel(t)
    const posSay = pos ? `在${pos}` : ''
    if (hit.type === 'line' || hit.type === 'arrow') {
      return { actions: [{ kind: 'add', shape: { type: hit.type, x: cx - hit.w / 2, y: cy, x2: cx + hit.w / 2, y2: cy, fill: 'none', stroke: color || '#333', strokeWidth: 5 } }], say: `已${posSay}画${hit.name}` }
    }
    return { actions: [{ kind: 'add', shape: { type: hit.type, x: cx - hit.w / 2, y: cy - hit.h / 2, w: hit.w, h: hit.h, fill: color || '#cfe3ff', stroke: '#2d7ff9', strokeWidth: 3 } }], say: `已${posSay}画${color ? colorName(t) : ''}${hit.name}` }
  }

  // —— 旋转 ——
  if (/(旋转|转(?!换)|歪|斜)/.test(t)) { const n = pickNumber(t) ?? 45; return { actions: [{ kind: 'rotate', deg: n }], say: `已旋转${n}度` } }

  // —— 缩放 ——
  if (/(大一点|大一些|放大|变大|大点)/.test(t)) { const n = pickNumber(t); return { actions: [{ kind: 'scale', factor: n && n > 1 ? n : 1.3 }], say: '已放大' } }
  if (/(小一点|小一些|缩小|变小|小点)/.test(t)) { const n = pickNumber(t); return { actions: [{ kind: 'scale', factor: n && n > 1 ? 1 / n : 0.77 }], say: '已缩小' } }

  // —— 移动（需明确移动动词；方位词只有配合"移/挪/X移"才当方向）——
  if (/(移|挪)/.test(t) || /(向左|向右|向上|向下|左移|右移|上移|下移)/.test(t)) {
    if (/(中间|中央|居中|正中)/.test(t)) return { actions: [{ kind: 'moveTo', x: 500, y: 350 }], say: '已移到中间' }
    const step = pickNumber(t) ?? 60
    if (/左/.test(t)) return { actions: [{ kind: 'move', dx: -step, dy: 0 }], say: '已左移' }
    if (/右/.test(t)) return { actions: [{ kind: 'move', dx: step, dy: 0 }], say: '已右移' }
    if (/上/.test(t)) return { actions: [{ kind: 'move', dx: 0, dy: -step }], say: '已上移' }
    if (/下/.test(t)) return { actions: [{ kind: 'move', dx: 0, dy: step }], say: '已下移' }
  }

  // —— 想要"新的一个X"但不是已知矢量形状 → 交给 LLM（如"换一个紫色的人"）——
  if (/一[个张只条头幅尊位]/.test(t) && !hit && drawVerb) return null

  // —— 仅说颜色：改当前选中对象 ——
  const onlyColor = pickColor(t)
  if (onlyColor && t.length <= 6) return { actions: [{ kind: 'recolor', color: onlyColor }], say: '颜色已更新' }
  if (onlyColor && /(变|改|换|设为|涂成|填充)/.test(t) && !/一[个张只条]/.test(t)) {
    return { actions: [{ kind: 'recolor', color: onlyColor }], say: '颜色已更新' }
  }

  return null
}
