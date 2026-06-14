// 图标统一用 Phosphor（taste-skill 禁止手画 SVG 图标）。
// 保持 <Icon name="..." /> 的调用方式不变，内部映射到 Phosphor 组件。
import {
  Lightning, Sparkle, Microphone, Palette, DownloadSimple, Trash, PaperPlaneRight,
  Image as ImageIcon, ChartLineUp, ChatCircle, Shapes, TreeStructure, ArrowCounterClockwise,
  Check, Stop, MagicWand, PencilSimple, X, Stack, Cube, PaintBrush, Coins, Warning, Flask,
  User, ArrowRight, SlidersHorizontal, CaretDown, Keyboard,
} from '@phosphor-icons/react'

const MAP: Record<string, any> = {
  zap: Lightning, sparkles: Sparkle, mic: Microphone, palette: Palette,
  download: DownloadSimple, trash: Trash, send: PaperPlaneRight, image: ImageIcon,
  chart: ChartLineUp, message: ChatCircle, shapes: Shapes, flow: TreeStructure,
  undo: ArrowCounterClockwise, check: Check, stop: Stop, wand: MagicWand,
  edit: PencilSimple, cancel: X, layers: Stack, cube: Cube, brush: PaintBrush,
  coins: Coins, alert: Warning, flask: Flask, user: User, arrowRight: ArrowRight,
  sliders: SlidersHorizontal, chevron: CaretDown, keyboard: Keyboard,
}

export default function Icon({ name, size = 18, className, weight = 'regular' }:
  { name: string; size?: number; className?: string; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone' }) {
  const C = MAP[name] || Sparkle
  return <C size={size} className={className} weight={weight} />
}
