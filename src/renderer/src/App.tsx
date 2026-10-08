import { useCallback, useEffect, useRef, useState } from 'react'
import { CollageStudio } from './components/CollageStudio'
import { ReleaseTools } from './components/Release'
import { Mark } from './components/Mark'
import { ImageLibrary } from './components/ImageLibrary'
import { Lightbox } from './components/Lightbox'
import { base64ToBytes, blobToBase64 } from './lib/bytes'
import {
  EXPORT_LONG_SIDE,
  averagePhotoRatio,
  resolveCanvas,
  normalizeLongSide,
  resolveGrid,
  type AspectId,
  type CollageSettings,
  type GridMode
} from './lib/layout'
import { extensionFromFile, imageFilesFromDataTransfer, imageFilesFromList, isImageFile, loadPhotos, movePhoto, photoFromUrl, revokePhoto, storedPhotoUrl, type Photo } from './lib/photos'
import { collageFileName, renderCollage } from './lib/renderCollage'

type Notice = { text: string; tone: 'ok' | 'error' }

const initialSettings: CollageSettings = {
  aspectId: '16:9',
  customWidth: 0,
  customHeight: 0,
  gridMode: 'auto',
  columns: 3,
  rows: 2,
  gap: 10,
  fit: 'cover',
  background: '#ffffff',
  longSide: EXPORT_LONG_SIDE
}

const presetIds = new Set<AspectId>(['16:9', '4:3', '1:1', '3:4', '9:16'])

function readSettings(value: unknown): CollageSettings | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.aspectId !== 'string') return null
  const customWidth = ratioPart(item.customWidth)
  const customHeight = ratioPart(item.customHeight)
  let aspectId: AspectId
  if (item.aspectId === 'auto') aspectId = 'auto'
  else if (item.aspectId === 'custom') {
    if (customWidth < 1 || customHeight < 1) return null
    aspectId = 'custom'
  } else if (presetIds.has(item.aspectId as AspectId)) {
    aspectId = item.aspectId as AspectId
  } else {
    return null
  }

  let gridMode: GridMode
  if (item.gridMode === 'auto') gridMode = 'auto'
  else if (item.gridMode === 'manual' || item.gridMode === 'columns' || item.gridMode === 'rows') gridMode = 'manual'
  else return null

  if (item.fit !== 'cover' && item.fit !== 'contain') return null
  if (typeof item.columns !== 'number' || typeof item.rows !== 'number' || typeof item.gap !== 'number') return null
  if (typeof item.background !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(item.background)) return null
  return {
    aspectId,
    customWidth,
    customHeight,
    gridMode,
    columns: item.columns,
    rows: item.rows,
    gap: item.gap,
    fit: item.fit,
    background: item.background,
    longSide: typeof item.longSide === 'number' ? normalizeLongSide(item.longSide) : EXPORT_LONG_SIDE
  }
}

function ratioPart(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const rounded = Math.round(value)
  if (rounded < 1 || rounded > 999) return 0
  return rounded
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [settings, setSettings] = useState<CollageSettings>(initialSettings)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [fileDrag, setFileDrag] = useState(false)
  const dragDepth = useRef(0)
  const addsInFlight = useRef(0)
  const readyRef = useRef(false)

  const addFiles = useCallback(async (files: File[]) => {
    if (!readyRef.current) return
    const images = files.filter(isImageFile)
    if (images.length === 0) {
      if (files.length > 0) setNotice({ text: 'Можно добавлять только изображения', tone: 'error' })
      return
    }

    addsInFlight.current += 1
    setAdding(true)
    try {
      const result = await loadPhotos(images)
      const saved: Photo[] = []
      const saveErrors = [...result.errors]
      for (const item of result.photos) {
        try {
          await rememberPhoto(item.file, item.photo)
          saved.push(item.photo)
        } catch {
          revokePhoto(item.photo)
          saveErrors.push(item.photo.name)
        }
      }
      if (saved.length > 0) setPhotos((current) => [...current, ...saved])
      if (saveErrors.length > 0) setNotice({ text: `Не удалось открыть: ${saveErrors.join(', ')}`, tone: 'error' })
    } finally {
      addsInFlight.current -= 1
      if (addsInFlight.current === 0) setAdding(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        if (window.collage) {
          const library = await window.collage.loadLibrary()
          if (cancelled) return
          const storedSettings = readSettings(library.settings)
          if (storedSettings) setSettings(storedSettings)

          const restored: Photo[] = []
          const broken: string[] = []
          for (const record of library.photos) {
            try {
              restored.push(await photoFromUrl({ id: record.id, name: record.name, url: storedPhotoUrl(record.id) }))
            } catch {
              broken.push(record.name)
            }
          }
          if (cancelled) {
            restored.forEach(revokePhoto)
            return
          }
          setPhotos(restored)
          if (broken.length > 0) setNotice({ text: `Не удалось открыть: ${broken.join(', ')}`, tone: 'error' })
        }
      } catch {
        if (!cancelled) setNotice({ text: 'Не удалось открыть сохранённые фото', tone: 'error' })
      } finally {
        if (!cancelled) {
          readyRef.current = true
          setRestoring(false)
          setHydrated(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !window.collage) return
    const timer = window.setTimeout(() => {
      void window.collage.saveLibrarySettings(settings)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [hydrated, settings])

  const pasteFromClipboard = useCallback(async () => {
    try {
      if (window.collage) {
        const base64 = await window.collage.readClipboardPng()
        if (base64) {
          const bytes = base64ToBytes(base64)
          const file = new File([bytes], 'Из буфера.png', { type: 'image/png' })
          await addFiles([file])
          return
        }
      }

      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read()
        const files: File[] = []
        for (const item of items) {
          const type = item.types.find((entry) => entry.startsWith('image/'))
          if (!type) continue
          const blob = await item.getType(type)
          files.push(new File([blob], 'Из буфера.png', { type }))
        }
        if (files.length > 0) {
          await addFiles(files)
          return
        }
      }

      setNotice({ text: 'В буфере обмена нет изображения', tone: 'error' })
    } catch {
      setNotice({ text: 'Не удалось прочитать буфер обмена', tone: 'error' })
    }
  }, [addFiles])

  const addElectronClipboard = useCallback(async () => {
    if (!window.collage) return
    try {
      const base64 = await window.collage.readClipboardPng()
      if (!base64) return
      const bytes = base64ToBytes(base64)
      const file = new File([bytes], 'Из буфера.png', { type: 'image/png' })
      await addFiles([file])
    } catch {
      setNotice({ text: 'Не удалось прочитать буфер обмена', tone: 'error' })
    }
  }, [addFiles])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = imageFilesFromDataTransfer(event.clipboardData)
      if (files.length > 0) {
        event.preventDefault()
        void addFiles(files)
        return
      }

      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      void addElectronClipboard()
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addElectronClipboard, addFiles])

  useEffect(() => {
    if (notice?.tone !== 'ok') return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const removePhoto = (id: string) => {
    if (!readyRef.current) return
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id)
      if (photo) revokePhoto(photo)
      return current.filter((item) => item.id !== id)
    })
    setActiveId((current) => (current === id ? null : current))
    void window.collage?.removeStoredPhoto(id).catch(() => {
      setNotice({ text: 'Не удалось удалить фото с диска', tone: 'error' })
    })
  }

  const clearPhotos = () => {
    if (!readyRef.current) return
    setPhotos((current) => {
      current.forEach(revokePhoto)
      return []
    })
    setActiveId(null)
    void window.collage?.clearStoredPhotos().catch(() => {
      setNotice({ text: 'Не удалось очистить сохранённые фото', tone: 'error' })
    })
  }

  const renderCurrentCollage = () => {
    const ratio = resolveCanvas(settings, photos).ratio
    const grid = resolveGrid(photos.length, ratio, settings.gridMode, settings.columns, settings.rows, averagePhotoRatio(photos))
    return renderCollage(photos, {
      ratio,
      longSide: settings.longSide,
      cols: grid.cols,
      rows: grid.rows,
      gap: settings.gap,
      fit: settings.fit,
      background: settings.background
    })
  }

  const copyCollage = async () => {
    if (photos.length === 0 || saving || copying) return
    setCopying(true)
    setNotice(null)
    try {
      const blob = await renderCurrentCollage()
      const png = blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setNotice({ text: 'Коллаж скопирован', tone: 'ok' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Не удалось скопировать коллаж', tone: 'error' })
    } finally {
      setCopying(false)
    }
  }

  const download = async () => {
    if (photos.length === 0 || saving || copying) return
    setSaving(true)
    setNotice(null)
    try {
      const blob = await renderCurrentCollage()
      const name = collageFileName()

      if (window.collage) {
        const result = await window.collage.savePng(await blobToBase64(blob), name)
        if (!result.canceled) setNotice({ text: 'Коллаж сохранён', tone: 'ok' })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.click()
        URL.revokeObjectURL(url)
        setNotice({ text: 'Коллаж скачан', tone: 'ok' })
      }
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Не удалось собрать коллаж', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const isFileDrag = (event: React.DragEvent) => event.dataTransfer.types.includes('Files')

  return (
    <div
      className="app"
      onDragEnter={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        dragDepth.current += 1
        setFileDrag(true)
      }}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(event) => {
        if (!isFileDrag(event)) return
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setFileDrag(false)
        }
      }}
      onDrop={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        dragDepth.current = 0
        setFileDrag(false)
        const files = imageFilesFromList(event.dataTransfer.files)
        if (files.length > 0) void addFiles(files)
      }}
    >
      <header className="topbar">
        <div className="brand">
          <Mark />
          <div>
            <h1>Холст</h1>
            <p>Коллаж из ваших фотографий</p>
          </div>
        </div>
        <ReleaseTools />
      </header>

      {notice && (
        <p className={notice.tone === 'ok' ? 'banner is-ok' : 'banner'} role="status" data-status>
          {notice.text}
        </p>
      )}

      <main className="workspace">
        <ImageLibrary
          photos={photos}
          adding={adding}
          onAddFiles={(files) => void addFiles(files)}
          onPaste={() => void pasteFromClipboard()}
          restoring={restoring}
          onRemove={removePhoto}
          onClear={clearPhotos}
          onOpen={setActiveId}
          onReorder={(from, to) => {
            if (!readyRef.current) return
            setPhotos((current) => {
              const next = movePhoto(current, from, to)
              void window.collage?.reorderStoredPhotos(next.map((photo) => photo.id))
              return next
            })
          }}
        />
        <CollageStudio
          photos={photos}
          settings={settings}
          saving={saving}
          copying={copying}
          restoring={restoring}
          onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
          onCopy={() => void copyCollage()}
          onDownload={() => void download()}
        />
      </main>

      {activeId && photos.some((photo) => photo.id === activeId) && (
        <Lightbox photos={photos} activeId={activeId} onClose={() => setActiveId(null)} onChange={setActiveId} />
      )}

      {fileDrag && <div className="drop-overlay">Отпустите, чтобы добавить фото</div>}
    </div>
  )
}

async function rememberPhoto(file: File, photo: Photo): Promise<void> {
  if (!window.collage) return
  const sourcePath = window.collage.pathForFile(file)
  if (sourcePath) {
    await window.collage.addPhotoFromPath({
      id: photo.id,
      name: photo.name,
      width: photo.width,
      height: photo.height,
      sourcePath
    })
    return
  }

  await window.collage.addPhotoFromBytes({
    id: photo.id,
    name: photo.name,
    width: photo.width,
    height: photo.height,
    base64: await blobToBase64(file),
    extension: extensionFromFile(file)
  })
}
