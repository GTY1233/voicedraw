// 指令路由 —— 整个交互的大脑。
// 决策顺序：模式切换 → 流程图 → 线框图 → 创意(生图/重绘) → 本地规则引擎 → LLM 兜底。
import { parseLocal } from './localParser'
import { execute } from './executor'
import { useApp } from '../store/appStore'
import { useScene } from '../store/sceneStore'
import { say } from '../voice/tts'
import { nlu, generateImage, editImage, visionConfirm } from '../api/client'
import { exportPNG, exportSVG } from '../scene/exportImage'
import { FLOW_SYS, HIERARCHY_SYS, ACTIONS_SYS, IMG_PROMPT_SYS, extractJson } from '../nlu/prompts'
import { layoutGraph, type Graph, type DiagramKind } from '../scene/layout'
import type { Action } from './types'

// 结构化图表类型识别 —— 这些走矢量自动排版，绝不走 AI 生图
const DIAGRAMS: { re: RegExp; kind: DiagramKind; name: string }[] = [
  { re: /(流程图|流程[:：]|逻辑图|步骤图|画.*流程)/, kind: 'flow', name: '流程图' },
  { re: /(组织架构图?|组织结构图?|公司架构|架构图|组织图)/, kind: 'org', name: '组织架构图' },
  { re: /(思维导图|脑图|心智图)/, kind: 'mindmap', name: '思维导图' },
  { re: /(树状图|层级图|目录树|分类树|关系树)/, kind: 'tree', name: '树状图' },
]
const detectDiagram = (t: string) => {
  // 编辑措辞（把X改成Y / 把X删掉）不应重新生成整张图
  if (/把.+(改名|改成|改为|换成|删掉|删除|去掉|移除)/.test(t)) return null
  return DIAGRAMS.find((d) => d.re.test(t)) || null
}

// 矢量图表的"节点级编辑"：改名 / 删除某个节点（不重新生成、不误走图像编辑）
function tryDiagramNodeEdit(text: string): boolean {
  const st = useScene.getState()
  const labels = st.nodes.filter((n) => n.type === 'text' && n.id.startsWith('lbl_'))
  if (labels.length < 2) return false // 画布上没有矢量图表
  const norm = (s?: string) => (s || '').replace(/\s|\n/g, '').toLowerCase()
  const findByTerm = (term: string) => {
    const k = norm(term)
    if (!k) return undefined
    return labels.find((l) => norm(l.text) && (k.includes(norm(l.text)) || norm(l.text).includes(k)))
  }

  // 改名：把X改成/改为/换成/改名为 Y
  let m = text.match(/把(.+?)(?:改名为?|改成|改为|换成|变成|叫做)(.+)/)
  if (m) {
    const to = m[2].replace(/[。.！!，,、]+$/, '').trim()
    const target = findByTerm(m[1])
    if (target && to) {
      const nodeId = 'node_' + target.id.slice(4)
      const node = st.nodes.find((n) => n.id === nodeId)
      if (node && node.w != null) { // 加宽节点避免新文字溢出
        const needW = Math.max(node.w, to.length * 16 + 36)
        const cx = node.x + node.w / 2
        st.update(nodeId, { w: needW, x: cx - needW / 2 })
      }
      st.update(target.id, { text: to })
      feedback(`已把节点「${norm(target.text)}」改为「${to}」`)
      return true
    }
  }

  // 删除节点：把X删掉/删除/去掉/移除
  m = text.match(/(?:把|将)?(.+?)(?:这个|那个)?(?:节点)?(?:删掉|删除|去掉|去除|移除)/)
  if (m) {
    const target = findByTerm(m[1])
    if (target) {
      st.remove(target.id)
      st.remove('node_' + target.id.slice(4))
      feedback(`已删除节点「${norm(target.text)}」`)
      return true
    }
  }
  return false
}

function feedback(text: string) {
  const app = useApp.getState()
  app.pushLog('system', text)
  app.showToast(text)
  setTimeout(() => { if (useApp.getState().toast === text) useApp.getState().showToast(null) }, 2600)
  say(text)
}

export async function handleUtterance(raw: string) {
  const text = raw.trim()
  if (!text) return
  const app = useApp.getState()
  app.pushLog('user', text)

  // —— 对话式确认：若有待确认的生图/改图，先处理"确认 / 修正 / 取消" ——
  if (app.pending && (await handlePending(text))) return

  // —— 导出 ——
  if (/(导出|下载|保存).{0,4}(图片|图|画面|png|svg)?/i.test(text) && /(导出|下载|保存)/.test(text)) {
    if (/svg/i.test(text)) exportSVG(); else exportPNG()
    feedback('已导出当前画面'); return
  }

  // —— 模式切换 ——
  if (/(创意模式|切换.*创意|生成模式)/.test(text)) { app.setMode('creative'); feedback('已切换到创意模式，说出你想画的画面'); return }
  if (/(效率模式|回到效率|矢量模式|画图模式)/.test(text)) { app.setMode('efficiency'); feedback('已回到效率模式'); return }

  // —— 全局纯控制（任何模式）：撤销/重做/清空。不含"删除"，避免吞掉图像编辑指令 ——
  if (/(撤销|回退|撤回|重做|恢复刚才|清空|清除画布|全部清掉|重新开始)/.test(text)) {
    const ctrl = parseLocal(text); if (ctrl) { execute(ctrl.actions); feedback(ctrl.say); return }
  }
  // —— 风格滤镜（矢量层）——
  if (/(水彩|手绘|霓虹|复古|像素|黑白|去掉风格|无风格|原始风格)/.test(text) && /(风格|滤镜|切换|换成|改成|变为|用|去掉|恢复)/.test(text)) {
    const ctrl = parseLocal(text); if (ctrl) { execute(ctrl.actions); feedback(ctrl.say); return }
  }

  // —— 矢量图表节点编辑（改名/删除某节点）：在"重新生成 / 图像编辑"之前拦截 ——
  if (tryDiagramNodeEdit(text)) return

  // —— 结构化图表（流程图/组织架构图/思维导图/树状图）→ 矢量自动排版，绝不走 AI 生图 ——
  const diag = detectDiagram(text)
  if (diag) return doDiagram(text, diag)

  // —— 线框图 / 原型 ——
  if (/(线框图|原型图|界面布局|wireframe|画.*页面|登录页|注册页)/i.test(text)) return doNluActions(text, '线框图已生成')

  const scene = useScene.getState()

  // —— 图像（创意模式核心）——
  if (app.imageEnabled) {
    const hasArt = !!scene.background
    const wantNew = /(重新画|重新生成|再生成|换一[张幅]|另(画|生成)|重画|再来一[张幅]|换张图|新画一?[张幅]?)/.test(text)
    if (app.mode === 'creative') {
      // 创意模式：已有 AI 图时，一切自然语言默认理解为"在这张图上修改/局部重绘"（含删除/去除/加…）
      if (hasArt && !wantNew) return requestEdit(text)
      return requestGenerate(text)
    }
    // 效率模式：仅显式的生图/改图意图才走云端
    const editish = hasArt && /(把|让|将|给|删|移除|去除|去掉|抹掉)/.test(text) &&
      /(画面|图(里|中|上|片)|左|右|上方|下方|中间|那个|这个|天空|背景|颜色|色调|删|去|移|抹|加|变|改|换)/.test(text)
    const genIntent = /(生成一?[张幅]?|画一[幅张]|来一[张幅]|帮我画.*(场景|画面|氛围|风格|插画)|画面[:：])/.test(text)
    if (editish) return requestEdit(text)
    if (genIntent) return requestGenerate(text)
  }

  // —— 效率模式矢量：本地规则引擎优先（<5ms）→ LLM 兜底 ——
  const local = parseLocal(text)
  if (local) { execute(local.actions); feedback(local.say); return }
  if (app.imageEnabled) return doNluActions(text)

  feedback('没太听懂。可以说：画一个红色的圆；画一个组织架构图；或切换到创意模式')
}

async function doDiagram(text: string, d: { kind: DiagramKind; name: string }) {
  const app = useApp.getState()
  app.setBusy(`正在理解结构、自动排版「${d.name}」…`)
  try {
    const sys = d.kind === 'flow' ? FLOW_SYS : HIERARCHY_SYS
    const content = await nlu([{ role: 'system', content: sys }, { role: 'user', content: text }])
    const g = extractJson<Graph>(content)
    if (!g.nodes?.length) throw new Error('未能解析出结构')
    if (!g.direction) g.direction = d.kind === 'mindmap' ? 'LR' : 'TB'
    const shapes = layoutGraph(g, d.kind)
    useScene.getState().replaceAll(shapes)
    feedback(`${d.name}已生成，共 ${g.nodes.length} 个节点`)
  } catch (e: any) {
    feedback(`${d.name}生成失败：` + (e.message || '未知错误'))
  } finally { app.setBusy(null) }
}

async function doNluActions(text: string, okSay?: string) {
  const app = useApp.getState()
  app.setBusy('正在解析指令…')
  try {
    const content = await nlu([{ role: 'system', content: ACTIONS_SYS }, { role: 'user', content: text }])
    const parsed = extractJson<{ actions: Action[]; say?: string }>(content)
    if (!parsed.actions?.length) throw new Error('未解析出动作')
    execute(parsed.actions)
    feedback(okSay || parsed.say || '已完成')
  } catch (e: any) {
    feedback('指令解析失败：' + (e.message || '未知错误'))
  } finally { app.setBusy(null) }
}

function stripGenPrefix(t: string) {
  return t.replace(/^(创意模式[，,、]?|画一[幅张]|画|生成一?[张幅]?|来一[张幅]|帮我画|画面[:：]?)/, '').replace(/[。.]$/, '').trim()
}

// ===== 对话式确认 =====
const AFFIRM = /^(对|对的|对对|是|是的|没错|可以|可以了|确认|确定|好|好的|嗯|就这样|没问题|行|要|画吧|开始|发吧|ok)[。.!！]*$/i
const CANCEL = /(取消|算了|不要了|不画了|不改了|先不|不用了)/
const ESCAPE = /(效率模式|创意模式|清空|撤销|重做|流程图|组织架构图|架构图|思维导图|树状图|线框图|导出|下载|保存图)/

// 处理"待确认"状态下的回复：确认→执行 / 取消→放弃 / 其它→视作修正再确认 / 切别的指令→放行
async function handlePending(text: string): Promise<boolean> {
  const app = useApp.getState()
  const p = app.pending!
  if (CANCEL.test(text)) { app.setPending(null); feedback('好的，已取消'); return true }
  if (ESCAPE.test(text)) { app.setPending(null); return false }
  if (AFFIRM.test(text.trim())) {
    app.setPending(null)
    if (p.kind === 'generate') await fireGenerate(p.prompt)
    else await fireEdit(p.prompt)
    return true
  }
  // 视为修正：去掉"不对/应该"等噪声词，带上修正内容重新确认
  app.setPending(null)
  const fix = text.replace(/^(不对|不是|应该|而是|改成|要改成|得是|是)[，,。.、:：]*/g, '').trim() || text
  if (p.kind === 'generate') await requestGenerate(p.raw + '，' + fix)
  else await requestEdit(p.raw + '。修正：' + fix)
  return true
}

// —— 第一步：复述确认（不真正调用昂贵的生图接口）——
async function requestGenerate(text: string) {
  const app = useApp.getState()
  app.setBusy('正在理解你的想法…')
  let prompt = ''
  try {
    const content = await nlu([{ role: 'system', content: IMG_PROMPT_SYS }, { role: 'user', content: text }])
    const r = extractJson<{ prompt?: string; ok?: boolean }>(content)
    if (r.ok && r.prompt) prompt = r.prompt.trim()
  } catch {}
  app.setBusy(null)
  if (!prompt) prompt = stripGenPrefix(text) // 降级
  if (!prompt) { feedback('你想画点什么呢？说说画面内容，比如"雪山日出"'); return }
  const question = `要画「${prompt}」这样的画面吗？满意就说"对"，或者直接说怎么改。`
  app.setPending({ kind: 'generate', prompt, raw: text, question })
  feedback(question)
}

async function requestEdit(text: string) {
  const app = useApp.getState()
  const bg = useScene.getState().background
  if (!bg) { feedback('画布上还没有可编辑的图片'); return }
  app.setBusy('正在看图、理解你的修改…')
  try {
    const { question, prompt } = await visionConfirm(bg, text) // 让 qwen-vl 真的看一眼图
    app.setPending({ kind: 'edit', prompt, raw: text, question })
    feedback(question + '（说"对"确认，或说出修正）')
  } catch {
    const q = `要按「${text}」修改这张图吗？说"对"确认。`
    app.setPending({ kind: 'edit', prompt: text, raw: text, question: q })
    feedback(q)
  } finally { app.setBusy(null) }
}

// —— 第二步：用户确认后才真正调用生图/改图接口（含限流冷却）——
let lastImageAt = 0
const COOLDOWN_MS = 5000
async function imageCooldown() {
  const wait = lastImageAt + COOLDOWN_MS - Date.now()
  if (wait > 0) { useApp.getState().setBusy(`为避免限流，${Math.ceil(wait / 1000)} 秒后开始…`); await new Promise((r) => setTimeout(r, wait)) }
  lastImageAt = Date.now()
}

async function fireGenerate(prompt: string) {
  const app = useApp.getState()
  await imageCooldown()
  app.setBusy('正在为你绘制，大约几秒…'); say('好的，正在绘制')
  try {
    const { image, cached } = await generateImage(prompt)
    useScene.getState().setBackground(image)
    useApp.getState().addArt(image, prompt)
    useApp.getState().setMode('creative')
    feedback(cached ? '已从缓存取出。想改的话直接说' : '画好了！想改的话直接说，比如"把天空变暖橙色"')
  } catch (e: any) {
    feedback('生成失败：' + (e.message || ''))
  } finally { app.setBusy(null) }
}

async function fireEdit(prompt: string) {
  const app = useApp.getState()
  const bg = useScene.getState().background
  if (!bg) { feedback('画布上还没有可编辑的图片'); return }
  await imageCooldown()
  app.setBusy('正在局部重绘…'); say('好的，正在修改')
  try {
    const { image } = await editImage(prompt, bg)
    useScene.getState().setBackground(image)
    useApp.getState().addArt(image, '✏️ ' + prompt)
    feedback('改好了！还想怎么调整？')
  } catch (e: any) {
    feedback('重绘失败：' + (e.message || '未知错误'))
  } finally { app.setBusy(null) }
}
