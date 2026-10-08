import type { CollageSettings } from './layout'

type WatermarkOptions = Pick<CollageSettings, 'watermarkKind' | 'watermarkText' | 'watermarkOpacity' | 'watermarkTone'>

export function drawWatermark(context: CanvasRenderingContext2D, width: number, height: number, options: WatermarkOptions): void {
  const alpha = Math.min(0.75, Math.max(0.08, options.watermarkOpacity / 100))
  const color = options.watermarkTone === 'dark' ? '#1c1917' : '#ffffff'
  const shadow = options.watermarkTone === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(28,25,23,0.45)'

  context.save()
  context.globalAlpha = alpha
  context.fillStyle = color
  context.strokeStyle = color
  context.shadowColor = shadow
  context.lineJoin = 'round'
  context.lineCap = 'round'

  if (options.watermarkKind === 'lattice') drawLattice(context, width, height)
  else {
    const text = options.watermarkText.trim()
    if (text) {
      if (options.watermarkKind === 'center') drawCenter(context, width, height, text)
      else if (options.watermarkKind === 'corner') drawCorner(context, width, height, text)
      else drawTiled(context, width, height, text)
    }
  }

  context.restore()
}

function drawLattice(context: CanvasRenderingContext2D, width: number, height: number): void {
  const step = Math.max(22, Math.round(Math.min(width, height) / 11))
  const span = Math.hypot(width, height)
  context.save()
  context.beginPath()
  context.rect(0, 0, width, height)
  context.clip()
  context.translate(width / 2, height / 2)
  context.rotate(Math.PI / 4)
  context.lineWidth = Math.max(1, Math.min(width, height) / 460)
  context.shadowBlur = context.lineWidth * 1.5
  context.beginPath()
  for (let pos = -span; pos <= span; pos += step) {
    context.moveTo(pos, -span)
    context.lineTo(pos, span)
    context.moveTo(-span, pos)
    context.lineTo(span, pos)
  }
  context.stroke()
  context.restore()
}

function drawTiled(context: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  const size = Math.max(15, Math.min(width, height) * 0.042)
  const span = Math.hypot(width, height)
  context.save()
  context.translate(width / 2, height / 2)
  context.rotate(-Math.PI / 6)
  setFont(context, size)
  const stepX = context.measureText(text).width + size * 2.6
  const stepY = size * 3.5
  let row = 0
  for (let y = -span; y <= span; y += stepY) {
    const shift = row % 2 === 0 ? 0 : stepX / 2
    for (let x = -span; x <= span; x += stepX) context.fillText(text, x + shift, y)
    row += 1
  }
  context.restore()
}

function drawCenter(context: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  let size = Math.max(28, Math.min(width, height) * 0.16)
  context.save()
  context.translate(width / 2, height / 2)
  context.rotate(-Math.PI / 7)
  setFont(context, size)
  const measured = context.measureText(text).width
  if (measured > width * 0.86) setFont(context, size * ((width * 0.86) / measured))
  context.fillText(text, 0, 0)
  context.restore()
}

function drawCorner(context: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  const size = Math.max(13, Math.min(width, height) * 0.042)
  const pad = Math.max(10, size * 0.8)
  context.save()
  setFont(context, size)
  context.textAlign = 'right'
  context.textBaseline = 'bottom'
  context.fillText(text, width - pad, height - pad)
  context.restore()
}

function setFont(context: CanvasRenderingContext2D, size: number): void {
  const px = Math.max(10, Math.round(size))
  context.font = `700 ${px}px "Segoe UI", system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.shadowBlur = Math.max(1, px * 0.12)
}
