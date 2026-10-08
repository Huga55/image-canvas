import { useEffect, useRef } from 'react'
import type { Photo } from '../lib/photos'

type LightboxProps = {
  photos: Photo[]
  activeId: string
  onClose: () => void
  onChange: (id: string) => void
}

export function Lightbox({ photos, activeId, onClose, onChange }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const index = photos.findIndex((photo) => photo.id === activeId)
  const photo = photos[index]

  useEffect(() => {
    dialogRef.current?.focus()
  }, [activeId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (photos.length < 2) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        const next = photos[(index + 1) % photos.length]
        if (next) onChange(next.id)
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        const previous = photos[(index - 1 + photos.length) % photos.length]
        if (previous) onChange(previous.id)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onChange, onClose, photos])

  if (!photo || index < 0) return null

  const go = (step: number) => {
    const next = photos[(index + step + photos.length) % photos.length]
    if (next) onChange(next.id)
  }

  return (
    <div className="lightbox" data-lightbox role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={photo.name}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lightbox-bar">
          <p>
            {index + 1} из {photos.length}
            <span className="lightbox-name">· {photo.name}</span>
          </p>
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <div className="lightbox-stage">
          {photos.length > 1 && (
            <button type="button" className="lightbox-nav is-prev" onClick={() => go(-1)} aria-label="Предыдущее фото">
              ‹
            </button>
          )}
          <img src={photo.fullUrl} alt={photo.name} />
          {photos.length > 1 && (
            <button type="button" className="lightbox-nav is-next" onClick={() => go(1)} aria-label="Следующее фото">
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
