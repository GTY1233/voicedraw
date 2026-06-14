import StyleSelector from './StyleSelector'
import Icon from './Icon'
import { handleUtterance } from '../commands/router'

const GROUPS: { label: string; icon: string; chips: string[] }[] = [
  { label: '绘制图形', icon: 'shapes', chips: ['画一个红色的圆', '画一个蓝色矩形', '画一个菱形', '写文字：登录'] },
  { label: '变换 / 编辑', icon: 'sliders', chips: ['大一点', '向右移', '旋转45度', '撤销', '清空'] },
  { label: '一句话出图表', icon: 'flow', chips: ['画一个登录流程图', '画一个公司组织架构图', '画一个产品思维导图', '画一个注册页线框图'] },
]

export default function EfficiencyPanel() {
  return (
    <>
      <div className="section">
        <div className="section-title"><Icon name="zap" size={13} className="ic" />语音指令</div>
        {GROUPS.map((g) => (
          <div className="hint-group" key={g.label}>
            <div className="hint-label"><Icon name={g.icon} size={13} className="ic" />{g.label}</div>
            <div className="chips">
              {g.chips.map((c) => (
                <span key={c} className="chip" onClick={() => handleUtterance(c)}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="section">
        <div className="section-title"><Icon name="palette" size={13} className="ic" />画面风格</div>
        <StyleSelector />
      </div>
    </>
  )
}
