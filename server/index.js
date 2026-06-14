// VoiceDraw 后端代理
// 职责：持有七牛密钥（绝不暴露给浏览器）、统一封装"对话理解 / 文生图 / 局部重绘"、
//       做生图缓存与成本计量（端云协同成本控制的可演示证据）。
import express from 'express'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'

dotenv.config()

// 用 || 兜底：dotenv 会把空字符串也读进来，不能只靠解构默认值
const QINIU_API_KEY = process.env.QINIU_API_KEY
const QINIU_BASE_URL = process.env.QINIU_BASE_URL || 'https://api.qnaigc.com/v1'
const NLU_MODEL = process.env.NLU_MODEL || 'deepseek-v3'
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image'
const IMAGE_MODEL_HQ = process.env.IMAGE_MODEL_HQ || 'gemini-3.0-pro-image-preview'
const VISION_MODEL = process.env.VISION_MODEL || 'qwen2.5-vl-72b-instruct'
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const DASHSCOPE_ASR_MODEL = process.env.DASHSCOPE_ASR_MODEL || 'paraformer-realtime-v2'
const DASH_WS = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'

const PORT = process.env.PORT || 8787

if (!QINIU_API_KEY) {
  console.warn('[warn] 未检测到 QINIU_API_KEY，云端能力（生图/重绘/理解）将不可用，仅本地功能可跑。')
}

// ---- 成本计量（粗略单价，用于演示"成本仪表盘"）----
const PRICE = { nlu: 0.001, image: 0.3 } // 元/次（估算）
const stats = { nluCalls: 0, genCalls: 0, editCalls: 0, cacheHits: 0, estCostRMB: 0 }
const bump = (kind) => { stats.estCostRMB += PRICE[kind] || 0 }

// ---- 生图缓存：相同 prompt+model 不重复烧钱 ----
const imageCache = new Map() // key -> { image, text, at }
const cacheKey = (model, prompt) => crypto.createHash('md5').update(model + '::' + prompt).digest('hex')

const app = express()
app.use(express.json({ limit: '25mb' })) // 局部重绘要把图片 base64 传进来

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- 调七牛 chat completions 的统一封装（含 429 限流自动重试+退避）----
async function qiniuChat(body, { retries = 0, retryDelayMs = 3500 } = {}) {
  if (!QINIU_API_KEY) throw new Error('NO_KEY')
  for (let attempt = 0; ; attempt++) {
    const resp = await fetch(`${QINIU_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${QINIU_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await resp.text()
    let json
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    if (resp.ok) return json

    const msg = json?.error?.message || text || `HTTP ${resp.status}`
    // 撞 RPM 限流：等待后重试（退避递增）
    if (resp.status === 429 && attempt < retries) {
      console.log(`[retry] 429 限流，${retryDelayMs * (attempt + 1)}ms 后重试 (${attempt + 1}/${retries})`)
      await sleep(retryDelayMs * (attempt + 1))
      continue
    }
    const err = new Error(msg)
    err.status = resp.status
    err.body = json
    throw err
  }
}

// 从 chat 返回里稳健地抽取图片（兼容 images[].image_url.url 与 content 内联 dataURI）
function extractImage(json) {
  const msg = json?.choices?.[0]?.message
  if (!msg) return null
  if (Array.isArray(msg.images) && msg.images[0]?.image_url?.url) {
    return msg.images[0].image_url.url
  }
  if (typeof msg.content === 'string') {
    const m = msg.content.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/)
    if (m) return m[0]
  }
  return null
}
const extractText = (json) => json?.choices?.[0]?.message?.content || ''

// ============ 路由 ============

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// 前端据此优雅降级：没 key 就隐藏云端按钮
app.get('/api/config', (_req, res) => {
  res.json({
    imageEnabled: !!QINIU_API_KEY,
    nluEnabled: !!QINIU_API_KEY,
    asrEnabled: !!DASHSCOPE_API_KEY,
    models: { nlu: NLU_MODEL, image: IMAGE_MODEL, imageHq: IMAGE_MODEL_HQ, asr: DASHSCOPE_ASR_MODEL },
  })
})

app.get('/api/stats', (_req, res) => res.json(stats))

// 语义理解：复杂自然语句 → 结构化操作 / 流程图逻辑抽取。前端传 messages（含 system）。
app.post('/api/nlu', async (req, res) => {
  try {
    const { messages, model = NLU_MODEL, temperature = 0, response_format } = req.body || {}
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages 必填' })
    const json = await qiniuChat({ model, messages, temperature, ...(response_format ? { response_format } : {}) })
    stats.nluCalls++; bump('nlu')
    res.json({ content: extractText(json), usage: json.usage })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

// 文生图：用 gemini 图像模型，明确"直接出图"指令以提升贴合度。带缓存。
app.post('/api/image/generate', async (req, res) => {
  try {
    const { prompt, fast = false, style = '', nocache = false } = req.body || {}
    if (!prompt) return res.status(400).json({ error: 'prompt 必填' })
    // 默认用 Pro（gemini-3.0）——实测纯生成贴合度明显优于 flash；fast=true 时退回 flash 求速度
    const model = fast ? IMAGE_MODEL : IMAGE_MODEL_HQ
    const fullPrompt = style ? `${prompt}，${style}风格` : prompt
    const key = cacheKey(model, fullPrompt)

    if (!nocache && imageCache.has(key)) {
      stats.cacheHits++
      return res.json({ image: imageCache.get(key).image, cached: true })
    }

    const instruction =
      `直接生成一张图片，只输出图像、不要输出任何文字说明。严格按照以下画面描述作画：\n${fullPrompt}`
    const json = await qiniuChat({ model, modalities: ['text', 'image'], messages: [{ role: 'user', content: instruction }] }, { retries: 2 })
    const image = extractImage(json)
    if (!image) return res.status(502).json({ error: '模型未返回图片', text: extractText(json).slice(0, 200) })

    imageCache.set(key, { image, text: extractText(json), at: Date.now() })
    stats.genCalls++; bump('image')
    res.json({ image, cached: false, usage: json.usage })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

// 局部重绘 / 指令编辑：输入图(dataURI) + 自然语言指令 → 改后的图（免蒙版）。
app.post('/api/image/edit', async (req, res) => {
  try {
    const { prompt, image, hq = false } = req.body || {}
    if (!prompt || !image) return res.status(400).json({ error: 'prompt 与 image 必填' })
    const model = hq ? IMAGE_MODEL_HQ : IMAGE_MODEL
    const json = await qiniuChat({
      model,
      modalities: ['text', 'image'],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${prompt}。请直接输出修改后的图片，保持其余内容不变。` },
          { type: 'image_url', image_url: { url: image } },
        ],
      }],
    }, { retries: 2 })
    const out = extractImage(json)
    if (!out) return res.status(502).json({ error: '模型未返回图片', text: extractText(json).slice(0, 200) })
    stats.editCalls++; bump('image')
    res.json({ image: out, usage: json.usage })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

// 视觉确认：用 qwen-vl 真的看一眼当前图，生成"确认话术"+"精炼编辑指令"（改图前的确认环节）
app.post('/api/vision/confirm', async (req, res) => {
  try {
    const { image, instruction } = req.body || {}
    if (!image || !instruction) return res.status(400).json({ error: 'image 与 instruction 必填' })
    const sys = `你是图像编辑助手。请仔细观察这张图片，然后针对用户的修改要求输出 JSON：
{"question":"一句中文，向用户确认你将如何修改——要具体指出图中的对象/位置/颜色等便于用户核对，以问号结尾","prompt":"一句精炼明确的图像编辑指令，指明改哪里、怎么改"}
只输出 JSON，不要解释或代码块。用户的修改要求是：「${instruction}」`
    const json = await qiniuChat({
      model: VISION_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'text', text: sys },
        { type: 'image_url', image_url: { url: image } },
      ] }],
    }, { retries: 1 })
    stats.nluCalls++; bump('nlu')
    const txt = extractText(json)
    let parsed
    try {
      let t = txt.replace(/```(?:json)?/g, '').trim()
      const s = t.indexOf('{'), e = t.lastIndexOf('}')
      parsed = JSON.parse(t.slice(s, e + 1))
    } catch { parsed = {} }
    res.json({
      question: parsed.question || `要按「${instruction}」修改这张图吗？`,
      prompt: parsed.prompt || instruction,
    })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

const server = app.listen(PORT, () => {
  console.log(`[VoiceDraw] 后端代理已启动 http://localhost:${PORT}  (image: ${IMAGE_MODEL}, asr: ${DASHSCOPE_API_KEY ? DASHSCOPE_ASR_MODEL : '未配置'})`)
})

// ===== 实时语音识别 WebSocket 代理：浏览器 ↔ 本后端 ↔ 阿里 DashScope =====
// 浏览器发 16k/16bit/单声道 PCM 二进制帧；后端转发给 DashScope，回传逐字结果。
const wss = new WebSocketServer({ server, path: '/api/asr' })
wss.on('connection', (client) => {
  if (!DASHSCOPE_API_KEY) {
    client.send(JSON.stringify({ type: 'error', message: '后端未配置 DASHSCOPE_API_KEY' }))
    client.close(); return
  }
  const taskId = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
  const up = new WebSocket(DASH_WS, { headers: { Authorization: 'bearer ' + DASHSCOPE_API_KEY } })
  let started = false
  const queue = [] // task-started 之前缓存音频帧

  up.on('open', () => {
    up.send(JSON.stringify({
      header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
      payload: {
        task_group: 'audio', task: 'asr', function: 'recognition',
        model: DASHSCOPE_ASR_MODEL,
        parameters: { format: 'pcm', sample_rate: 16000 },
        input: {},
      },
    }))
  })

  up.on('message', (data, isBinary) => {
    if (isBinary) return
    let msg; try { msg = JSON.parse(data.toString()) } catch { return }
    const ev = msg.header?.event
    if (ev === 'task-started') {
      started = true
      for (const f of queue) up.send(f); queue.length = 0
      safeSend(client, { type: 'ready' })
    } else if (ev === 'result-generated') {
      const s = msg.payload?.output?.sentence
      if (s && typeof s.text === 'string') safeSend(client, { type: 'result', text: s.text, isFinal: !!s.sentence_end })
    } else if (ev === 'task-finished') {
      safeSend(client, { type: 'finished' }); try { up.close() } catch {}
    } else if (ev === 'task-failed') {
      safeSend(client, { type: 'error', message: msg.header?.error_message || '识别任务失败' }); try { up.close() } catch {}
    }
  })
  up.on('error', (e) => safeSend(client, { type: 'error', message: '语音上游错误：' + e.message }))
  up.on('close', () => { try { client.close() } catch {} })

  client.on('message', (data, isBinary) => {
    if (isBinary) {
      if (up.readyState === WebSocket.OPEN) { started ? up.send(data) : queue.push(data) }
    } else {
      let m; try { m = JSON.parse(data.toString()) } catch { return }
      if (m.action === 'finish') finishUp(up, taskId)
    }
  })
  client.on('close', () => finishUp(up, taskId))
})

function safeSend(ws, obj) { try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)) } catch {} }
function finishUp(up, taskId) {
  try {
    if (up.readyState === WebSocket.OPEN) {
      up.send(JSON.stringify({ header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' }, payload: { input: {} } }))
    }
  } catch {}
}
