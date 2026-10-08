import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import type { Photo } from '../lib/photos'

type ImageLibraryProps = {
  photos: Photo[]
  adding: boolean
  restoring: boolean
  onAddFiles: (files: File[]) => void
  onPaste: () => void
  onRemove: (id: string) => void
  onClear: () => void
  onOpen: (id: string) => void
  onReorder: (from: number, to: number) => void
}

export function ImageLibrary({
  photos,
  adding,
  restoring,
  onAddFiles,
  onPaste,
  onRemove,
  onClear,
  onOpen,
  onReorder
}: ImageLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const draggedIndex = useRef<number | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    if (photos.length === 0) setConfirmClear(false)
  }, [photos.length])

  return (
    <section className="panel library">
      <div className="panel-head">
        <h2>Фотографии</h2>
        <span className="count">{photos.length}</span>
      </div>

      <div className={photos.length > 0 ? 'dropzone is-compact' : 'dropzone'}>
        <p className="dropzone-title">{restoring ? 'Открываем сохранённые фото…' : adding ? 'Добавляем…' : 'Перетащите изображения сюда'}</p>
        <p className="hint">Новые фото добавляются к уже загруженным и остаются после обновления. Из буфера — Ctrl+V.</p>
        <div className="dropzone-actions">
          <button type="button" className="primary" disabled={restoring} onClick={() => inputRef.current?.click()}>
            Выбрать файлы
          </button>
          <button type="button" disabled={restoring} onClick={onPaste}>
            Вставить
          </button>
        </div>
        <input
          ref={inputRef}
          data-file-input
          className="visually-hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = event.target.files
            if (files && files.length > 0) onAddFiles(Array.from(files))
            event.target.value = ''
          }}
        />
      </div>

      {photos.length > 0 && <p className="hint order-hint">Порядок в коллаже — слева направо. Превью можно перетаскивать.</p>}

      <div className="thumbs">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            role="button"
            className={overIndex === index ? 'thumb is-over' : 'thumb'}
            draggable
            tabIndex={0}
            aria-label={`Открыть ${photo.name}`}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false
                return
              }
              onOpen(photo.id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(photo.id)
              }
            }}
            onDragStart={(event) => {
              draggedIndex.current = index
              suppressClick.current = true
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(index))
            }}
            onDragEnd={() => {
              draggedIndex.current = null
              setOverIndex(null)
            }}
            onDragOver={(event) => {
              if (draggedIndex.current === null) return
              event.preventDefault()
              event.stopPropagation()
              setOverIndex(index)
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const from = Number(event.dataTransfer.getData('text/plain'))
              setOverIndex(null)
              if (Number.isInteger(from)) onReorder(from, index)
            }}
          >
            <img src={photo.thumbUrl} alt="" draggable={false} />
            <button
              type="button"
              className="thumb-remove"
              aria-label={`Удалить ${photo.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onRemove(photo.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {photos.length > 0 && (
        <button type="button" className="clear-all" onClick={() => setConfirmClear(true)}>
          Очистить
        </button>
      )}

      {confirmClear && (
        <Dialog title="Удалить все фото?" onClose={() => setConfirmClear(false)}>
          <p>Список очистится, и фото пропадут с этого компьютера.</p>
          <div className="modal-actions">
            <button type="button" onClick={() => setConfirmClear(false)}>
              Оставить
            </button>
            <button
              type="button"
              className="danger-solid"
              onClick={() => {
                setConfirmClear(false)
                onClear()
              }}
            >
              Удалить
            </button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
