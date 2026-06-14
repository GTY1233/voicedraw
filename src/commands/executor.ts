import { useScene, newId, currentTarget } from '../store/sceneStore'
import type { Shape } from '../scene/types'
import type { Action } from './types'

const fullShape = (p: Partial<Shape> & { type: Shape['type'] }): Shape => ({
  id: newId(),
  x: 400, y: 300,
  fill: '#cfe3ff', stroke: '#2d7ff9', strokeWidth: 3, rotation: 0,
  ...p,
})

export function execute(actions: Action[]) {
  const st = useScene.getState()
  for (const a of actions) {
    const target = currentTarget(useScene.getState())
    switch (a.kind) {
      case 'add':
        st.add(fullShape(a.shape))
        break
      case 'recolor':
        if (target) {
          if (target.type === 'line' || target.type === 'arrow') st.update(target.id, { stroke: a.color })
          else if (target.type === 'text') st.update(target.id, { fill: a.color })
          else st.update(target.id, { fill: a.color })
        }
        break
      case 'move':
        if (target) {
          const patch: Partial<Shape> = { x: target.x + a.dx, y: target.y + a.dy }
          if (target.x2 != null) patch.x2 = target.x2 + a.dx
          if (target.y2 != null) patch.y2 = target.y2 + a.dy
          st.update(target.id, patch)
        }
        break
      case 'moveTo':
        if (target) {
          const w = target.w ?? 0, h = target.h ?? 0
          st.update(target.id, { x: a.x - w / 2, y: a.y - h / 2 })
        }
        break
      case 'scale':
        if (target) {
          const patch: Partial<Shape> = {}
          if (target.w != null) patch.w = Math.max(20, target.w * a.factor)
          if (target.h != null) patch.h = Math.max(20, target.h * a.factor)
          if (target.fontSize != null) patch.fontSize = Math.max(10, target.fontSize * a.factor)
          if (target.x2 != null) { // line/arrow：绕中点缩放
            const mx = (target.x + target.x2) / 2, my = (target.y + (target.y2 ?? target.y)) / 2
            patch.x = mx + (target.x - mx) * a.factor
            patch.x2 = mx + (target.x2 - mx) * a.factor
            patch.y = my + (target.y - my) * a.factor
            patch.y2 = my + ((target.y2 ?? target.y) - my) * a.factor
          }
          st.update(target.id, patch)
        }
        break
      case 'rotate':
        if (target) st.update(target.id, { rotation: (target.rotation || 0) + a.deg })
        break
      case 'delete':
        if (target) st.remove(target.id)
        break
      case 'undo': st.undo(); break
      case 'redo': st.redo(); break
      case 'clear': st.clear(); break
      case 'bgColor': {
        const bg = fullShape({ type: 'rect', x: 0, y: 0, w: 1000, h: 700, fill: a.color, stroke: 'none', strokeWidth: 0 })
        bg.id = '__bg'
        const rest = useScene.getState().nodes.filter((n) => n.id !== '__bg')
        st.replaceAll([bg, ...rest])
        break
      }
      case 'style': st.setStyle(a.filter); break
      case 'select': {
        const nodes = useScene.getState().nodes
        if (a.which === 'last') st.select(nodes.at(-1)?.id ?? null)
        else { const f = [...nodes].reverse().find((n) => n.type === a.which); if (f) st.select(f.id) }
        break
      }
    }
  }
}
