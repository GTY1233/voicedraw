import type { Shape, ShapeType, StyleFilter } from '../scene/types'

// 解析器产出的动作（本地引擎与 LLM 都产出同一套，executor 统一执行）
export type Action =
  | { kind: 'add'; shape: Partial<Shape> & { type: ShapeType } }
  | { kind: 'recolor'; color: string }
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'moveTo'; x: number; y: number }
  | { kind: 'scale'; factor: number }
  | { kind: 'rotate'; deg: number }
  | { kind: 'delete' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'clear' }
  | { kind: 'bgColor'; color: string }
  | { kind: 'style'; filter: StyleFilter }
  | { kind: 'select'; which: 'last' | ShapeType }

export interface ParseResult {
  actions: Action[]
  say: string // TTS 语音反馈
}
