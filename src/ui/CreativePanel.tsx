import { useApp } from '../store/appStore'
import { useScene } from '../store/sceneStore'
import { handleUtterance } from '../commands/router'
import Icon from './Icon'

const PROMPTS = [
  '画一幅雨夜的东京小巷，霓虹灯，赛博朋克风格',
  '画一只柴犬，扁平矢量插画风格',
  '黄昏海边，粉紫色天空，椰子树剪影',
]
const EDITS = ['把整体改成暖橙色调', '让天空更紫一些', '在前景加一把红伞']

// 直接下载 dataURI 作品
function downloadArt(image: string, prompt: string) {
  const a = document.createElement('a')
  a.href = image
  a.download = `voicedraw-${prompt.slice(0, 12).replace(/[\\/:*?"<>|\s]/g, '_') || 'art'}.png`
  a.click()
}

export default function CreativePanel() {
  const { gallery, imageEnabled, showToast } = useApp()
  const setBackground = useScene((s) => s.setBackground)
  const current = gallery[0]

  // 点缩略图：恢复到画布
  const restore = (image: string) => { setBackground(image); showToast('已恢复到画布') }

  return (
    <>
      <div className="section">
        <div className="section-title"><Icon name="wand" size={13} className="ic" />创意工作台</div>

        {!imageEnabled && (
          <div className="warn-card">
            <Icon name="alert" size={15} className="ic" />
            <span>云端图像未启用（缺少 key 或额度），生图与重绘暂不可用。</span>
          </div>
        )}

        {!current && imageEnabled && (
          <div className="hint-group">
            <div className="hint-label"><Icon name="sparkles" size={13} className="ic" />说出你想画的画面</div>
            <div className="chips">
              {PROMPTS.map((p) => (
                <span key={p} className="chip" onClick={() => handleUtterance(p)}>{p}</span>
              ))}
            </div>
          </div>
        )}

        {current && (
          <>
            <div className="art-current">
              <div className="frame">
                <img src={current.image} alt={current.prompt} className="reveal" key={current.id} />
                <div className="actions">
                  <button className="icon-btn" title="恢复到画布" onClick={() => restore(current.image)}><Icon name="layers" size={15} /></button>
                  <button className="icon-btn" title="下载" onClick={() => downloadArt(current.image, current.prompt)}><Icon name="download" size={15} /></button>
                </div>
              </div>
              <div className="meta">
                <Icon name="image" size={14} className="ic" />
                <span className="ptxt">{current.prompt}</span>
              </div>
            </div>

            <div className="edit-tip">
              <div className="et-head"><Icon name="brush" size={14} />继续语音局部重绘</div>
              试着说出修改要求，画面会在原图基础上更新：
              <div className="et-chips">
                {EDITS.map((e) => <span key={e} onClick={() => handleUtterance(e)} style={{ cursor: 'pointer' }}>{e}</span>)}
              </div>
            </div>
          </>
        )}
      </div>

      {gallery.length > 1 && (
        <div className="section">
          <div className="section-title">
            <Icon name="layers" size={13} className="ic" />作品库
            <span className="count">{gallery.length}</span>
          </div>
          <div className="gallery">
            {gallery.map((a) => (
              <div className="gallery-cell" key={a.id} title={a.prompt} onClick={() => restore(a.image)}>
                <img src={a.image} alt={a.prompt} />
                <div className="restore"><Icon name="layers" size={16} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
