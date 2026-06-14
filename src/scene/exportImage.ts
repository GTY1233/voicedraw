// 把当前画布导出为 PNG / SVG（演示后可直接放进 PPT）。
import { CANVAS_W, CANVAS_H } from './SceneSvg'

const getSvg = () => document.querySelector('.scene-svg') as SVGSVGElement | null

const download = (url: string, name: string) => {
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
}

export function exportSVG() {
  const svg = getSvg(); if (!svg) return
  const xml = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([xml], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  download(url, `voicedraw-${Date.now()}.svg`)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function exportPNG(scale = 2): Promise<void> {
  return new Promise((resolve) => {
    const svg = getSvg(); if (!svg) return resolve()
    const xml = new XMLSerializer().serializeToString(svg)
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_W * scale; canvas.height = CANVAS_H * scale
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) { const url = URL.createObjectURL(blob); download(url, `voicedraw-${Date.now()}.png`); setTimeout(() => URL.revokeObjectURL(url), 4000) }
        resolve()
      }, 'image/png')
    }
    img.onerror = () => resolve()
    img.src = svgUrl
  })
}
