import SceneSvg from '../scene/SceneSvg'
import ConfirmCard from './ConfirmCard'
import Icon from './Icon'
import { useApp } from '../store/appStore'
import { useScene } from '../store/sceneStore'
import { exportPNG, exportSVG } from '../scene/exportImage'
import { handleUtterance } from '../commands/router'

const STYLE_NAMES: Record<string, string> = { watercolor: '水彩', sketch: '手绘', neon: '霓虹', pixel: '复古', mono: '黑白' }

// 空状态可点击的示例指令（按模式区分）
const EXAMPLES: Record<string, string[]> = {
  efficiency: ['画一个红色的圆', '画一个登录流程图', '画一个公司组织架构图'],
  creative: ['画一幅雨夜东京霓虹小巷，赛博朋克风格', '画一只柴犬，扁平插画风格'],
}

export default function CanvasStage() {
  const { mode, busy, interim } = useApp()
  const { nodes, background, styleFilter, clear } = useScene()
  const isEmpty = nodes.length === 0 && !background
  const creative = mode === 'creative'

  return (
    <div className="canvas-card">
      <SceneSvg />

      {/* 浮动工具条（模式标识由顶栏统一表达，此处不重复） */}
      <div className="canvas-toolbar">
        <div className="tool-group">
          {styleFilter && (
            <span className="pill style-pill"><Icon name="palette" size={14} className="ic" />{STYLE_NAMES[styleFilter]} 风格</span>
          )}
        </div>
        <div className="tool-group">
          <button className="pill" onClick={() => exportPNG()} title="导出 PNG"><Icon name="download" size={14} className="ic" />PNG</button>
          <button className="pill" onClick={() => exportSVG()} title="导出 SVG"><Icon name="download" size={14} className="ic" />SVG</button>
          {!isEmpty && <button className="pill danger" onClick={() => clear()} title="清空画布"><Icon name="trash" size={14} className="ic" />清空</button>}
        </div>
      </div>

      {/* 空状态：精心设计的引导 */}
      {isEmpty && !busy && (
        <div className="empty-hint">
          <div className="glyph"><Icon name={creative ? 'wand' : 'brush'} size={30} /></div>
          <div className="t1">{creative ? '说出你想画的画面，我来画～' : '说一句话，我帮你画出来'}</div>
          <div className="t2">{creative ? '描述场景、风格与氛围，小绘就为你生成画面' : '图形、流程图、架构图，说出来小绘都能画'}</div>
          <div className="empty-examples">
            {(creative ? EXAMPLES.creative : EXAMPLES.efficiency).map((e) => (
              <button key={e} className="empty-ex" onClick={() => handleUtterance(e)}>
                <Icon name="mic" size={13} className="ic" />{e}
              </button>
            ))}
          </div>
          <div className="empty-foot"><Icon name="mic" size={13} />点右侧「开始语音」跟我说，或直接试试上面的例子</div>
        </div>
      )}

      {/* 生成中：内容骨架（替代孤立 spinner） */}
      {busy && (
        <div className="gen-overlay">
          <div className="gen-card">
            <div className="gen-head">
              <span className="gen-spin" />
              <div>
                <div className="gen-title">{busy}</div>
                <div className="gen-sub">小绘正在认真画，马上就好～</div>
              </div>
            </div>
            <div className="skeleton"><i /><i /><i /></div>
          </div>
        </div>
      )}

      {/* 对话式确认气泡 */}
      <ConfirmCard />

      {/* 实时识别 */}
      {interim && (
        <div className="interim-pill">
          <span className="lvl"><i /><i /><i /><i /></span>
          {interim}
        </div>
      )}
    </div>
  )
}
