import { create } from 'zustand'

export type Mode = 'efficiency' | 'creative'
export interface LogItem { role: 'user' | 'system'; text: string; t: number }
export interface ArtItem { id: string; image: string; prompt: string }
// 待确认的生图/改图意图（对话式确认）
export interface Pending { kind: 'generate' | 'edit'; prompt: string; raw: string; question: string }

interface AppState {
  mode: Mode
  listening: boolean
  busy: string | null // 非空表示云端处理中，文案用于提示
  interim: string // 实时识别中间结果
  log: LogItem[]
  imageEnabled: boolean
  asrEnabled: boolean // 云端实时语音识别是否可用
  gallery: ArtItem[] // 创意模式生成的作品历史
  toast: string | null
  pending: Pending | null // 等待用户确认的生图/改图

  setMode: (m: Mode) => void
  setListening: (b: boolean) => void
  setBusy: (s: string | null) => void
  setInterim: (s: string) => void
  setImageEnabled: (b: boolean) => void
  setAsrEnabled: (b: boolean) => void
  pushLog: (role: LogItem['role'], text: string) => void
  addArt: (image: string, prompt: string) => void
  showToast: (s: string | null) => void
  setPending: (p: Pending | null) => void
}

let _aid = 0
export const useApp = create<AppState>((set) => ({
  mode: 'efficiency',
  listening: false,
  busy: null,
  interim: '',
  log: [],
  imageEnabled: false,
  asrEnabled: false,
  gallery: [],
  toast: null,
  pending: null,

  setMode: (mode) => set({ mode }),
  setListening: (listening) => set({ listening }),
  setBusy: (busy) => set({ busy }),
  setInterim: (interim) => set({ interim }),
  setImageEnabled: (imageEnabled) => set({ imageEnabled }),
  setAsrEnabled: (asrEnabled) => set({ asrEnabled }),
  pushLog: (role, text) => set((s) => ({ log: [...s.log, { role, text, t: Date.now() }].slice(-60) })),
  addArt: (image, prompt) => set((s) => ({ gallery: [{ id: 'art' + _aid++, image, prompt }, ...s.gallery].slice(0, 8) })),
  showToast: (toast) => set({ toast }),
  setPending: (pending) => set({ pending }),
}))
