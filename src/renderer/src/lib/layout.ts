export const ASPECTS = [
  { id: '16:9', ratio: 16 / 9 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '1:1', ratio: 1 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '9:16', ratio: 9 / 16 }
] as const

export type AspectId = (typeof ASPECTS)[number]['id'] | 'custom' | 'auto'
export type GridMode = 'auto' | 'manual'
export type FitMode = 'cover' | 'contain'

export type CollageSettings = {
  aspectId: AspectId
  customWidth: number
  customHeight: number
  gridMode: GridMode
  columns: number
  rows: number
  gap: number
  fit: FitMode
  background: string
  longSide: number
}

export const EXPORT_LONG_SIDE = 2400
export const MIN_LONG_SIDE = 480
export const MAX_LONG_SIDE = 7680
export const LONG_SIDE_PRESETS = [1280, 1920, 2400, 3840] as const

export type Grid = { cols: number; rows: number }

export function aspectById(id: AspectId): { id: AspectId; ratio: number } {
  return ASPECTS.find((item) => item.id === id) ?? ASPECTS[0]
}

export function canvasRatio(settings: Pick<CollageSettings, 'aspectId' | 'customWidth' | 'customHeight'>): number {
  if (settings.aspectId === 'custom' && settings.customWidth > 0 && settings.customHeight > 0) {
    return settings.customWidth / settings.customHeight
  }
  if (settings.aspectId === 'custom' || settings.aspectId === 'auto') return ASPECTS[0].ratio
  return aspectById(settings.aspectId).ratio
}

export function chooseAspect(
  photos: { width: number; height: number }[],
  settings: Pick<CollageSettings, 'gridMode' | 'columns' | 'rows' | 'fit'>
): { id: (typeof ASPECTS)[number]['id']; ratio: number } {
  const count = photos.length
  const photoRatio = averagePhotoRatio(photos)
  let best: (typeof ASPECTS)[number] = ASPECTS[0]
  let bestScore = Number.POSITIVE_INFINITY

  for (const aspect of ASPECTS) {
    const grid = resolveGrid(count, aspect.ratio, settings.gridMode, settings.columns, settings.rows, photoRatio)
    const cellRatio = (aspect.ratio * grid.rows) / grid.cols
    const mismatch = cellRatio >= photoRatio ? 1 - photoRatio / cellRatio : 1 - cellRatio / photoRatio
    const empty = count === 0 ? 0 : (grid.cols * grid.rows - count) / count
    const score = settings.fit === 'contain' ? mismatch * 1.7 + empty * 0.08 : mismatch * 0.55 + empty * 0.45
    if (score < bestScore) {
      best = aspect
      bestScore = score
    }
  }

  return { id: best.id, ratio: best.ratio }
}

export function resolveCanvas(
  settings: CollageSettings,
  photos: { width: number; height: number }[]
): { ratio: number; label: string } {
  if (settings.aspectId === 'auto') {
    const chosen = chooseAspect(photos, settings)
    return { ratio: chosen.ratio, label: chosen.id }
  }
  if (settings.aspectId === 'custom' && settings.customWidth > 0 && settings.customHeight > 0) {
    return { ratio: settings.customWidth / settings.customHeight, label: `${settings.customWidth}:${settings.customHeight}` }
  }
  const ratio = canvasRatio(settings)
  return { ratio, label: settings.aspectId === 'custom' ? '16:9' : settings.aspectId }
}

export function normalizeLongSide(value: number): number {
  if (!Number.isFinite(value)) return EXPORT_LONG_SIDE
  return clamp(Math.round(value), MIN_LONG_SIDE, MAX_LONG_SIDE)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function averagePhotoRatio(photos: { width: number; height: number }[]): number {
  const valid = photos.filter((photo) => photo.width > 0 && photo.height > 0)
  if (valid.length === 0) return 3 / 2
  const sum = valid.reduce((total, photo) => total + Math.log(photo.width / photo.height), 0)
  return Math.exp(sum / valid.length)
}

export function exportSize(ratio: number, longSide = EXPORT_LONG_SIDE): { width: number; height: number } {
  const side = normalizeLongSide(longSide)
  if (ratio >= 1) {
    return { width: side, height: Math.max(1, Math.round(side / ratio)) }
  }

  return { width: Math.max(1, Math.round(side * ratio)), height: side }
}

/**
 * Подбирает сетку, в которой ячейки ближе к пропорциям самих фото,
 * а пустых мест как можно меньше.
 */
export function autoGrid(count: number, canvasRatio: number, photoRatio = 1.5): Grid {
  if (count <= 1) return { cols: 1, rows: 1 }

  let best: Grid & { score: number } = { cols: 1, rows: count, score: Number.POSITIVE_INFINITY }

  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols)
    const cellRatio = (canvasRatio * rows) / cols
    const empty = rows * cols - count
    const shape = Math.abs(Math.log(cellRatio / photoRatio))
    const score = shape + empty * 0.22
    if (score < best.score) best = { cols, rows, score }
  }

  return { cols: best.cols, rows: best.rows }
}

export function resolveGrid(
  count: number,
  canvasRatio: number,
  mode: GridMode,
  columns: number,
  rows: number,
  photoRatio: number
): Grid {
  if (count <= 1 || mode === 'auto') return count <= 1 ? { cols: 1, rows: 1 } : autoGrid(count, canvasRatio, photoRatio)

  const cols = clamp(Math.round(columns) || 1, 1, count)
  const requestedRows = clamp(Math.round(rows) || 1, 1, count)
  return { cols, rows: Math.max(requestedRows, Math.ceil(count / cols)) }
}
