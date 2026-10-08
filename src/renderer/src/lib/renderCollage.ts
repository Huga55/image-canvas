import { exportSize, type FitMode, type WatermarkKind, type WatermarkTone } from './layout'
import type { Photo } from './photos'
import { drawWatermark } from './watermark'

export type CollageRenderOptions = {
  ratio: number
  longSide: number
  cols: number
  rows: number
  gap: number
  fit: FitMode
  background: string
  numbered: boolean
  watermark: boolean
  watermarkKind: WatermarkKind
  watermarkText: string
  watermarkOpacity: number
  watermarkTone: WatermarkTone
}

export function collageFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `коллаж-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.png`
}

export async function renderCollage(photos: Photo[], options: CollageRenderOptions): Promise<Blob> {
  if (photos.length === 0) throw new Error('Добавьте хотя бы одно фото')

  const { width, height } = exportSize(options.ratio, options.longSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Не удалось собрать коллаж')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = options.background
  context.fillRect(0, 0, width, height)

  const gap = (options.gap / 1000) * width

  for (let index = 0; index < photos.length && index < options.cols * options.rows; index += 1) {
    const photo = photos[index]
    if (!photo) continue
    const blob = await (await fetch(photo.fullUrl)).blob()
    const bitmap = await createImageBitmap(blob)
    try {
      const rect = cellRect(index, options.cols, options.rows, width, height, gap)
      drawFit(context, bitmap, bitmap.width, bitmap.height, rect.x, rect.y, rect.w, rect.h, options.fit)
      if (options.numbered) drawNumber(context, index + 1, rect.x, rect.y, rect.w, rect.h)
    } finally {
      bitmap.close()
    }
  }

  if (options.watermark) {
    drawWatermark(context, width, height, options)
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Не удалось собрать коллаж'))
    }, 'image/png')
  })
}

function drawNumber(context: CanvasRenderingContext2D, number: number, x: number, y: number, cellWidth: number, cellHeight: number): void {
  const text = String(number)
  const size = Math.max(18, Math.round(Math.min(cellWidth, cellHeight) * 0.16))
  const fontSize = Math.round(size * 0.62)
  context.save()
  context.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`
  const badgeWidth = Math.max(size, context.measureText(text).width + fontSize)
  const inset = Math.round(size * 0.32)
  const left = x + inset
  const top = y + inset
  context.beginPath()
  context.roundRect(left, top, badgeWidth, size, size / 2)
  context.fillStyle = 'rgba(23, 51, 46, 0.86)'
  context.fill()
  context.fillStyle = '#ffffff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, left + badgeWidth / 2, top + size / 2)
  context.restore()
}

function cellRect(
  index: number,
  cols: number,
  rows: number,
  width: number,
  height: number,
  gap: number
): { x: number; y: number; w: number; h: number } {
  const col = index % cols
  const row = Math.floor(index / cols)

  if (gap <= 0) {
    const x = Math.round((width * col) / cols)
    const x2 = Math.round((width * (col + 1)) / cols)
    const y = Math.round((height * row) / rows)
    const y2 = Math.round((height * (row + 1)) / rows)
    return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) }
  }

  const innerWidth = width - gap * (cols + 1)
  const innerHeight = height - gap * (rows + 1)
  const cellWidth = innerWidth / cols
  const cellHeight = innerHeight / rows
  const x = gap + col * (cellWidth + gap)
  const y = gap + row * (cellHeight + gap)
  return { x, y, w: cellWidth, h: cellHeight }
}

function drawFit(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: FitMode
): void {
  const imageRatio = imageWidth / imageHeight
  const cellRatio = width / height
  const wider = imageRatio > cellRatio

  let drawWidth: number
  let drawHeight: number
  if (fit === 'cover' ? wider : !wider) {
    drawHeight = height
    drawWidth = height * imageRatio
  } else {
    drawWidth = width
    drawHeight = width / imageRatio
  }

  const dx = x + (width - drawWidth) / 2
  const dy = y + (height - drawHeight) / 2

  context.save()
  context.beginPath()
  context.rect(x, y, width, height)
  context.clip()
  context.drawImage(image, dx, dy, drawWidth, drawHeight)
  context.restore()
}
