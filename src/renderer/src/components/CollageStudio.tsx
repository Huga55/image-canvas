import { useEffect, useRef, useState } from 'react'
import { RatioDialog } from './Dialog'
import {
  ASPECTS,
  LONG_SIDE_PRESETS,
  MIN_LONG_SIDE,
  MAX_LONG_SIDE,
  averagePhotoRatio,
  chooseAspect,
  resolveCanvas,
  exportSize,
  normalizeLongSide,
  resolveGrid,
  type CollageSettings,
  type Grid,
  type GridMode
} from '../lib/layout'
import type { Photo } from '../lib/photos'

const BACKGROUNDS = ['#ffffff', '#f4f1ea', '#d6d3d1', '#1c1917']

type CollageStudioProps = {
  photos: Photo[]
  settings: CollageSettings
  saving: boolean
  copying: boolean
  restoring: boolean
  onChange: (patch: Partial<CollageSettings>) => void
  onCopy: () => void
  onDownload: () => void
}

export function CollageStudio({ photos, settings, saving, copying, restoring, onChange, onCopy, onDownload }: CollageStudioProps) {
  const [ratioOpen, setRatioOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const canvas = resolveCanvas(settings, photos)
  const ratio = canvas.ratio
  const autoChoice = chooseAspect(photos, settings)
  const grid = resolveGrid(photos.length, ratio, settings.gridMode, settings.columns, settings.rows, averagePhotoRatio(photos))
  const size = exportSize(ratio, settings.longSide)
  const frame = useFitBox(ratio, true)
  const hasCustom = settings.customWidth > 0 && settings.customHeight > 0
  const manual = settings.gridMode === 'manual'
  const extraCells = manual && photos.length > 0 && grid.cols * grid.rows > photos.length
  const grewRows = manual && photos.length > 1 && grid.rows > settings.rows

  const selectMode = (mode: GridMode) => {
    if (mode === 'manual') onChange({ gridMode: 'manual', columns: grid.cols, rows: grid.rows })
    else onChange({ gridMode: 'auto' })
  }

  return (
    <section className="panel studio">
      <div className="panel-head">
        <div>
          <h2>Коллаж</h2>
          <p className="quiet">
            PNG {size.width}×{size.height}
          </p>
        </div>
        <div className="studio-actions">
          <button type="button" data-copy disabled={photos.length === 0 || saving || copying} onClick={onCopy}>
            {copying ? 'Копируем…' : 'Копировать'}
          </button>
          <button type="button" className="primary download" data-download disabled={photos.length === 0 || saving || copying} onClick={onDownload}>
            {saving ? 'Собираем…' : 'Скачать коллаж'}
          </button>
        </div>
      </div>

      <div className="stage" ref={frame.ref}>
        {photos.length === 0 && (
          <div className="stage-empty">
            <p>{restoring ? 'Открываем сохранённые фото' : 'Здесь будет коллаж'}</p>
            <p className="hint">{restoring ? 'Они лежат на этом компьютере.' : 'Добавьте фото слева — они сразу встанут в сетку.'}</p>
          </div>
        )}
        {photos.length > 0 && frame.size.width > 0 && (
          <CollageFrame
            photos={photos}
            grid={grid}
            settings={settings}
            width={frame.size.width}
            height={frame.size.height}
            onOpen={() => setExpanded(true)}
          />
        )}
      </div>
      {photos.length > 0 && <p className="hint stage-hint">Нажмите на коллаж, чтобы открыть на весь экран.</p>}

      <div className="check-row">
        <label className="check whole-photo">
          <input
            type="checkbox"
            checked={settings.fit === 'contain'}
            onChange={(event) => onChange({ fit: event.target.checked ? 'contain' : 'cover' })}
          />
          <span>Показать фото целиком</span>
        </label>
        <label className="check whole-photo">
          <input type="checkbox" checked={settings.numbered} onChange={(event) => onChange({ numbered: event.target.checked })} />
          <span>Порядковые номера</span>
        </label>
      </div>
      <p className="hint fit-hint">
        {settings.fit === 'contain' ? 'Фото не обрезаются. Свободное место в ячейке закрывает фон.' : 'Фото заполняет ячейку, лишнее по краям обрезается.'}
      </p>

      <div className="controls">
        <div className="control-block">
          <span className="control-label">Соотношение</span>
          <div className="ratios" role="radiogroup" aria-label="Соотношение сторон">
            <button
              type="button"
              role="radio"
              aria-checked={settings.aspectId === 'auto'}
              className={settings.aspectId === 'auto' ? 'ratio ratio-auto is-selected' : 'ratio ratio-auto'}
              onClick={() => onChange({ aspectId: 'auto' })}
            >
              <span className="ratio-shape" style={shapeSize(autoChoice.ratio)} />
              <span>Авто</span>
              {settings.aspectId === 'auto' && <span className="ratio-live">{autoChoice.id}</span>}
            </button>
            {ASPECTS.map((aspect) => {
              const shape = shapeSize(aspect.ratio)
              const selected = settings.aspectId === aspect.id
              return (
                <button
                  key={aspect.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? 'ratio is-selected' : 'ratio'}
                  onClick={() => onChange({ aspectId: aspect.id })}
                >
                  <span className="ratio-shape" style={{ width: shape.width, height: shape.height }} />
                  <span>{aspect.id}</span>
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={settings.aspectId === 'custom'}
              className={settings.aspectId === 'custom' ? 'ratio is-selected' : 'ratio'}
              onClick={() => setRatioOpen(true)}
            >
              <span
                className={hasCustom ? 'ratio-shape' : 'ratio-shape is-empty'}
                style={hasCustom ? shapeSize(settings.customWidth / settings.customHeight) : undefined}
              />
              <span>{hasCustom ? `${settings.customWidth}:${settings.customHeight}` : 'Своё'}</span>
            </button>
          </div>
        </div>

        <div className="control-block">
          <span className="control-label">Длинная сторона</span>
          <div className="sizes">
            {LONG_SIDE_PRESETS.map((side) => (
              <button
                key={side}
                type="button"
                className={settings.longSide === side ? 'is-selected' : ''}
                onClick={() => onChange({ longSide: side })}
              >
                {side}
              </button>
            ))}
            <LongSideField value={settings.longSide} onChange={(longSide) => onChange({ longSide })} />
          </div>
          <p className="hint">Вторая сторона считается из соотношения, форма коллажа от этого не меняется.</p>
        </div>

        <div className="control-block">
          <span className="control-label">Сетка</span>
          <div className="segmented" role="radiogroup" aria-label="Способ раскладки">
            <ModeButton mode="auto" current={settings.gridMode} onSelect={selectMode}>
              Авто
            </ModeButton>
            <ModeButton mode="manual" current={settings.gridMode} onSelect={selectMode}>
              Ручной
            </ModeButton>
          </div>
          <div className="steppers">
            <Stepper
              label="Колонки"
              value={manual ? settings.columns : grid.cols}
              min={1}
              max={Math.max(1, photos.length)}
              disabled={!manual || photos.length < 2}
              onChange={(columns) => onChange({ columns })}
            />
            <Stepper
              label="Строки"
              value={manual ? settings.rows : grid.rows}
              min={1}
              max={Math.max(1, photos.length)}
              disabled={!manual || photos.length < 2}
              onChange={(rows) => onChange({ rows })}
            />
            <p className="grid-result">{photos.length === 0 ? 'Пока нет фото' : `Получится ${grid.cols} × ${grid.rows}`}</p>
          </div>
          {grewRows && <p className="hint">Строк больше, чем задано: так в коллаж входят все фото.</p>}
          {extraCells && !grewRows && <p className="hint">Пустые ячейки закрывает фон.</p>}
        </div>

        <div className="control-row">
          <label className="slider">
            <span className="control-label">Промежуток</span>
            <input
              type="range"
              min={0}
              max={48}
              step={1}
              value={settings.gap}
              onChange={(event) => onChange({ gap: Number(event.target.value) })}
            />
          </label>

          <div>
            <span className="control-label">Фон</span>
            <div className="swatches">
              {BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={settings.background === color ? 'swatch is-selected' : 'swatch'}
                  style={{ background: color }}
                  aria-label={`Фон ${color}`}
                  aria-pressed={settings.background === color}
                  onClick={() => onChange({ background: color })}
                />
              ))}
              <input
                className="color-input"
                type="color"
                value={settings.background}
                aria-label="Свой цвет фона"
                onChange={(event) => onChange({ background: event.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {ratioOpen && (
        <RatioDialog
          width={settings.customWidth}
          height={settings.customHeight}
          onClose={() => setRatioOpen(false)}
          onApply={(customWidth, customHeight) => {
            onChange({ aspectId: 'custom', customWidth, customHeight })
            setRatioOpen(false)
          }}
        />
      )}
      {expanded && photos.length > 0 && (
        <CollageScreen photos={photos} grid={grid} settings={settings} ratio={ratio} onClose={() => setExpanded(false)} />
      )}
    </section>
  )
}

function CollageFrame({
  photos,
  grid,
  settings,
  width,
  height,
  onOpen
}: {
  photos: Photo[]
  grid: Grid
  settings: CollageSettings
  width: number
  height: number
  onOpen?: () => void
}) {
  const gapPx = (settings.gap / 1000) * width
  return (
    <div
      className={onOpen ? 'frame is-clickable' : 'frame'}
      data-collage
      data-cols={grid.cols}
      data-rows={grid.rows}
      data-aspect={settings.aspectId}
      role={onOpen ? 'button' : 'img'}
      tabIndex={onOpen ? 0 : undefined}
      title={onOpen ? 'Открыть на весь экран' : undefined}
      aria-label={`Коллаж ${grid.cols} на ${grid.rows}`}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
      style={{
        width,
        height,
        background: settings.background,
        gap: gapPx,
        padding: gapPx,
        gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`
      }}
    >
      {photos.map((photo, index) => (
        <div key={photo.id} className="cell">
          <img src={photo.fullUrl} alt="" draggable={false} style={{ objectFit: settings.fit }} />
          {settings.numbered && <span className="cell-index">{index + 1}</span>}
        </div>
      ))}
    </div>
  )
}

function CollageScreen({
  photos,
  grid,
  settings,
  ratio,
  onClose
}: {
  photos: Photo[]
  grid: Grid
  settings: CollageSettings
  ratio: number
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const frame = useFitBox(ratio, true)
  onCloseRef.current = onClose

  useEffect(() => {
    const node = rootRef.current
    let entered = false
    void node?.requestFullscreen?.().catch(() => undefined)
    const onChange = () => {
      if (document.fullscreenElement) entered = true
      else if (entered) onCloseRef.current()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) void document.exitFullscreen?.()
    }
  }, [])

  return (
    <div className="collage-screen" ref={rootRef} role="dialog" aria-modal="true" aria-label="Коллаж на весь экран">
      <div className="lightbox-bar">
        <p>
          Коллаж {grid.cols} × {grid.rows}
        </p>
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <div className="stage collage-screen-stage" ref={frame.ref}>
        {frame.size.width > 0 && <CollageFrame photos={photos} grid={grid} settings={settings} width={frame.size.width} height={frame.size.height} />}
      </div>
    </div>
  )
}

function LongSideField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <label className="size-field">
      <input
        type="number"
        min={MIN_LONG_SIDE}
        max={MAX_LONG_SIDE}
        value={text}
        aria-label="Длинная сторона в пикселях"
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const parsed = Number(next)
          if (Number.isFinite(parsed) && parsed >= MIN_LONG_SIDE && parsed <= MAX_LONG_SIDE) onChange(Math.round(parsed))
        }}
        onBlur={() => {
          const parsed = normalizeLongSide(Number(text))
          setText(String(parsed))
          onChange(parsed)
        }}
      />
      <span>px</span>
    </label>
  )
}

function ModeButton({
  mode,
  current,
  onSelect,
  children
}: {
  mode: GridMode
  current: GridMode
  onSelect: (mode: GridMode) => void
  children: string
}) {
  return (
    <button type="button" role="radio" aria-checked={current === mode} className={current === mode ? 'is-selected' : ''} onClick={() => onSelect(mode)}>
      {children}
    </button>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const shown = Math.min(max, Math.max(min, value || min))
  return (
    <div className="stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Меньше: ${label}`} disabled={disabled || shown <= min} onClick={() => onChange(shown - 1)}>
          −
        </button>
        <strong>{shown}</strong>
        <button type="button" aria-label={`Больше: ${label}`} disabled={disabled || shown >= max} onClick={() => onChange(shown + 1)}>
          +
        </button>
      </div>
    </div>
  )
}

function shapeSize(ratio: number): { width: number; height: number } {
  const max = 34
  if (ratio >= 1) return { width: max, height: Math.max(8, Math.round(max / ratio)) }
  return { width: Math.max(8, Math.round(max * ratio)), height: max }
}

function useFitBox(ratio: number, active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!active) return
    const element = ref.current
    if (!element) return

    const update = () => {
      const bounds = element.getBoundingClientRect()
      const availableWidth = Math.max(0, bounds.width - 28)
      const availableHeight = Math.max(0, bounds.height - 28)
      if (availableWidth < 2 || availableHeight < 2) return

      let width = availableWidth
      let height = width / ratio
      if (height > availableHeight) {
        height = availableHeight
        width = height * ratio
      }
      setSize({ width, height })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ratio, active])

  return { ref, size }
}
