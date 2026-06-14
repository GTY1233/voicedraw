// 前端只与本地 /api 通信，密钥在后端。
export interface AppConfig {
  imageEnabled: boolean
  nluEnabled: boolean
  asrEnabled: boolean
  models: { nlu: string; image: string; imageHq: string; asr: string }
}

export async function getConfig(): Promise<AppConfig> {
  const r = await fetch('/api/config')
  return r.json()
}

export async function getStats() {
  const r = await fetch('/api/stats')
  return r.json() as Promise<{ nluCalls: number; genCalls: number; editCalls: number; cacheHits: number; estCostRMB: number }>
}

export async function nlu(messages: any[], opts: { response_format?: any } = {}) {
  const r = await fetch('/api/nlu', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...opts }),
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `NLU ${r.status}`)
  return (await r.json()).content as string
}

export async function generateImage(prompt: string, opts: { hq?: boolean; style?: string } = {}) {
  const r = await fetch('/api/image/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...opts }),
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `生图失败 ${r.status}`)
  return (await r.json()) as { image: string; cached: boolean }
}

export async function visionConfirm(image: string, instruction: string) {
  const r = await fetch('/api/vision/confirm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, instruction }),
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `看图确认失败 ${r.status}`)
  return (await r.json()) as { question: string; prompt: string }
}

export async function editImage(prompt: string, image: string, hq = false) {
  const r = await fetch('/api/image/edit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image, hq }),
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `重绘失败 ${r.status}`)
  return (await r.json()) as { image: string }
}
