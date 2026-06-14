import { create } from 'zustand'
import type { Shape, Snapshot, StyleFilter } from '../scene/types'

let _id = 0
export const newId = () => `s${Date.now().toString(36)}_${_id++}`

interface SceneState {
  nodes: Shape[]
  selectedId: string | null
  background: string | null // AI 背景位图 dataURI
  styleFilter: StyleFilter
  past: Snapshot[]
  future: Snapshot[]

  // 操作（均自动记录历史，便于撤销/重做）
  add: (s: Shape) => void
  addMany: (s: Shape[]) => void
  update: (id: string, patch: Partial<Shape>) => void
  remove: (id: string) => void
  clear: () => void
  select: (id: string | null) => void
  setBackground: (dataUri: string | null) => void
  setStyle: (f: StyleFilter) => void
  replaceAll: (nodes: Shape[]) => void
  undo: () => void
  redo: () => void
}

const snap = (s: SceneState): Snapshot => ({
  nodes: JSON.parse(JSON.stringify(s.nodes)),
  background: s.background,
  styleFilter: s.styleFilter,
})

export const useScene = create<SceneState>((set, get) => {
  // 在变更前记录历史
  const commit = () => set((s) => ({ past: [...s.past, snap(s)].slice(-50), future: [] }))

  return {
    nodes: [],
    selectedId: null,
    background: null,
    styleFilter: null,
    past: [],
    future: [],

    add: (shape) => { commit(); set((s) => ({ nodes: [...s.nodes, shape], selectedId: shape.id })) },
    addMany: (arr) => { commit(); set((s) => ({ nodes: [...s.nodes, ...arr], selectedId: arr.at(-1)?.id ?? s.selectedId })) },
    update: (id, patch) => { commit(); set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })) },
    remove: (id) => { commit(); set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })) },
    clear: () => { commit(); set({ nodes: [], selectedId: null, background: null }) },
    select: (id) => set({ selectedId: id }),
    setBackground: (uri) => { commit(); set({ background: uri }) },
    setStyle: (f) => { commit(); set({ styleFilter: f }) },
    replaceAll: (nodes) => { commit(); set({ nodes, selectedId: nodes.at(-1)?.id ?? null }) },

    undo: () => set((s) => {
      if (!s.past.length) return s
      const prev = s.past[s.past.length - 1]
      return {
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future].slice(0, 50),
        nodes: prev.nodes,
        background: prev.background,
        styleFilter: prev.styleFilter,
        selectedId: null,
      }
    }),
    redo: () => set((s) => {
      if (!s.future.length) return s
      const next = s.future[0]
      return {
        future: s.future.slice(1),
        past: [...s.past, snap(s)].slice(-50),
        nodes: next.nodes,
        background: next.background,
        styleFilter: next.styleFilter,
        selectedId: null,
      }
    }),
  }
})

// 便捷选择器：当前选中或最近添加的节点
export const currentTarget = (s: SceneState): Shape | undefined =>
  s.nodes.find((n) => n.id === s.selectedId) ?? s.nodes.at(-1)
