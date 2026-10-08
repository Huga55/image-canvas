import { useEffect, useState, type ReactNode } from 'react'

type DialogProps = {
  title: string
  children: ReactNode
  onClose: () => void
}

export function Dialog({ title, children, onClose }: DialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

type RatioDialogProps = {
  width: number
  height: number
  onApply: (width: number, height: number) => void
  onClose: () => void
}

export function RatioDialog({ width, height, onApply, onClose }: RatioDialogProps) {
  const [widthText, setWidthText] = useState(width > 0 ? String(width) : '')
  const [heightText, setHeightText] = useState(height > 0 ? String(height) : '')
  const parsedWidth = parsePart(widthText)
  const parsedHeight = parsePart(heightText)
  const preview = parsedWidth && parsedHeight ? parsedWidth / parsedHeight : 1
  const shape = previewShape(preview)

  return (
    <Dialog title="Своё соотношение" onClose={onClose}>
      <p className="hint">Два целых числа, как 16 и 9. Прямоугольник сразу показывает форму.</p>
      <div className="ratio-form">
        <label>
          Ширина
          <input inputMode="numeric" value={widthText} onChange={(event) => setWidthText(event.target.value)} />
        </label>
        <span className="ratio-colon">:</span>
        <label>
          Высота
          <input inputMode="numeric" value={heightText} onChange={(event) => setHeightText(event.target.value)} />
        </label>
        <div className="ratio-preview" aria-hidden="true">
          <span style={{ width: shape.width, height: shape.height }} />
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="primary"
          disabled={!parsedWidth || !parsedHeight}
          onClick={() => {
            if (parsedWidth && parsedHeight) onApply(parsedWidth, parsedHeight)
          }}
        >
          Применить
        </button>
      </div>
    </Dialog>
  )
}

function parsePart(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  if (parsed < 1 || parsed > 999) return null
  return parsed
}

function previewShape(ratio: number): { width: number; height: number } {
  const max = 84
  if (ratio >= 1) return { width: max, height: Math.max(12, Math.round(max / ratio)) }
  return { width: Math.max(12, Math.round(max * ratio)), height: max }
}
