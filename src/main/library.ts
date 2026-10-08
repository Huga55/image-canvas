import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'path'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'tif', 'tiff'])

export type LibraryPhoto = {
  id: string
  name: string
  width: number
  height: number
}

type PhotoRecord = LibraryPhoto & { file: string }

type Manifest = {
  photos: PhotoRecord[]
  settings: unknown
}

export type NewLibraryPhoto = {
  id: string
  name: string
  width: number
  height: number
  sourcePath?: string
  base64?: string
  extension?: string
}

export function createLibrary(directory: string) {
  const root = resolve(directory)
  const manifestPath = join(root, 'manifest.json')
  let chain = Promise.resolve()

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task)
    chain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  return {
    load(): Promise<{ photos: LibraryPhoto[]; settings: unknown }> {
      return enqueue(async () => {
        const manifest = await readManifest(manifestPath)
        return {
          photos: manifest.photos.map(({ id, name, width, height }) => ({ id, name, width, height })),
          settings: manifest.settings
        }
      })
    },

    addFromPath(input: NewLibraryPhoto): Promise<void> {
      return enqueue(() => addPhoto(root, manifestPath, input, 'path'))
    },

    addFromBytes(input: NewLibraryPhoto): Promise<void> {
      return enqueue(() => addPhoto(root, manifestPath, input, 'bytes'))
    },

    remove(id: string): Promise<void> {
      return enqueue(() => removePhoto(root, manifestPath, id))
    },

    reorder(ids: string[]): Promise<void> {
      return enqueue(() => reorderPhotos(manifestPath, ids))
    },

    clear(): Promise<void> {
      return enqueue(() => clearPhotos(root, manifestPath))
    },

    saveSettings(settings: unknown): Promise<void> {
      return enqueue(async () => {
        const manifest = await readManifest(manifestPath)
        manifest.settings = settings ?? null
        await writeManifest(manifestPath, manifest)
      })
    },

    async respond(request: Request): Promise<Response> {
      const id = idFromUrl(request.url)
      if (!id) return new Response(null, { status: 404 })

      const manifest = await readManifest(manifestPath)
      const record = manifest.photos.find((photo) => photo.id === id)
      const filePath = record ? containedPath(root, record.file) : null
      if (!filePath) return new Response(null, { status: 404 })

      try {
        const bytes = await readFile(filePath)
        return new Response(new Uint8Array(bytes), {
          headers: {
            'Content-Type': mimeType(filePath),
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'private, max-age=86400'
          }
        })
      } catch {
        return new Response(null, { status: 404 })
      }
    }
  }
}

async function addPhoto(root: string, manifestPath: string, input: NewLibraryPhoto, kind: 'path' | 'bytes'): Promise<void> {
  const id = cleanId(input.id)
  const name = cleanName(input.name)
  const width = cleanSize(input.width)
  const height = cleanSize(input.height)
  const extension = kind === 'path' ? safeExtension(extname(input.sourcePath ?? '')) : safeExtension(input.extension ?? '')
  const relativeFile = `files/${id}.${extension}`
  const target = containedPath(root, relativeFile)
  if (!target) throw new Error('Некорректный путь')

  await mkdir(join(root, 'files'), { recursive: true })

  if (kind === 'path') {
    const sourcePath = input.sourcePath ?? ''
    const info = await stat(sourcePath)
    if (!info.isFile()) throw new Error('Это не файл')
    await copyFile(sourcePath, target)
  } else {
    const base64 = input.base64 ?? ''
    if (base64.length === 0 || base64.length > 160_000_000) throw new Error('Некорректное изображение')
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.length === 0) throw new Error('Пустое изображение')
    await writeFile(target, bytes)
  }

  const manifest = await readManifest(manifestPath)
  manifest.photos = manifest.photos.filter((photo) => photo.id !== id)
  manifest.photos.push({ id, name, width, height, file: relativeFile })
  await writeManifest(manifestPath, manifest)
}

async function removePhoto(root: string, manifestPath: string, id: string): Promise<void> {
  const photoId = cleanId(id)
  const manifest = await readManifest(manifestPath)
  const record = manifest.photos.find((photo) => photo.id === photoId)
  manifest.photos = manifest.photos.filter((photo) => photo.id !== photoId)
  await writeManifest(manifestPath, manifest)
  const filePath = record ? containedPath(root, record.file) : null
  if (filePath) await rm(filePath, { force: true })
}

async function reorderPhotos(manifestPath: string, ids: unknown): Promise<void> {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) throw new Error('Некорректный порядок')
  const manifest = await readManifest(manifestPath)
  const byId = new Map(manifest.photos.map((photo) => [photo.id, photo]))
  const next: PhotoRecord[] = []
  for (const id of ids) {
    const photo = byId.get(id)
    if (!photo) continue
    next.push(photo)
    byId.delete(id)
  }
  for (const photo of byId.values()) next.push(photo)
  manifest.photos = next
  await writeManifest(manifestPath, manifest)
}

async function clearPhotos(root: string, manifestPath: string): Promise<void> {
  const manifest = await readManifest(manifestPath)
  const paths = manifest.photos.map((photo) => containedPath(root, photo.file))
  manifest.photos = []
  await writeManifest(manifestPath, manifest)
  await Promise.all(paths.map((filePath) => (filePath ? rm(filePath, { force: true }) : undefined)))
}

async function readManifest(manifestPath: string): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as Partial<Manifest>
    const photos = Array.isArray(parsed.photos) ? parsed.photos.filter(isRecord) : []
    return { photos, settings: parsed.settings ?? null }
  } catch {
    return { photos: [], settings: null }
  }
}

async function writeManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  await mkdir(resolve(manifestPath, '..'), { recursive: true })
  const temporary = `${manifestPath}.tmp`
  await writeFile(temporary, JSON.stringify(manifest))
  await rm(manifestPath, { force: true })
  await rename(temporary, manifestPath)
}

function isRecord(value: unknown): value is PhotoRecord {
  if (!value || typeof value !== 'object') return false
  const photo = value as Partial<PhotoRecord>
  return (
    typeof photo.id === 'string' &&
    UUID.test(photo.id) &&
    typeof photo.name === 'string' &&
    typeof photo.file === 'string' &&
    photo.file === `files/${photo.id}.${extensionOf(photo.file)}` &&
    typeof photo.width === 'number' &&
    typeof photo.height === 'number'
  )
}

function containedPath(root: string, relativeFile: string): string | null {
  if (relativeFile.includes('\0')) return null
  const target = resolve(root, relativeFile)
  const rel = relative(root, target)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  return target
}

function idFromUrl(raw: string): string | null {
  try {
    const pathname = decodeURIComponent(new URL(raw).pathname)
    const id = pathname.split('/').filter(Boolean).at(-1) ?? ''
    return UUID.test(id) ? id : null
  } catch {
    return null
  }
}

function cleanId(id: string): string {
  if (!UUID.test(id)) throw new Error('Некорректный идентификатор')
  return id
}

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, 180)
  return trimmed || 'Фото'
}

function cleanSize(value: number): number {
  if (!Number.isFinite(value) || value < 1 || value > 200_000) throw new Error('Некорректный размер')
  return Math.round(value)
}

function safeExtension(value: string): string {
  const cleaned = value.toLowerCase().replace(/^\./, '')
  if (cleaned === 'jpeg') return 'jpg'
  if (EXTENSIONS.has(cleaned)) return cleaned
  return 'png'
}

function extensionOf(file: string): string {
  return file.split('.').pop()?.toLowerCase() ?? ''
}

function mimeType(file: string): string {
  const extension = extensionOf(file)
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'bmp') return 'image/bmp'
  if (extension === 'avif') return 'image/avif'
  if (extension === 'tif' || extension === 'tiff') return 'image/tiff'
  return 'image/png'
}
