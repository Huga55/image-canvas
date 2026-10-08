export type Photo = {
  id: string
  name: string
  fullUrl: string
  thumbUrl: string
  width: number
  height: number
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'tif', 'tiff'])

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(extension)
}

export function extensionFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (fromName === 'jpeg') return 'jpg'
  if (IMAGE_EXTENSIONS.has(fromName)) return fromName
  const mime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/avif': 'avif',
    'image/tiff': 'tif'
  }
  return mime[file.type] ?? 'png'
}

export function storedPhotoUrl(id: string): string {
  return `collage://photo/${id}`
}

export function imageFilesFromList(list: FileList | File[]): File[] {
  return Array.from(list).filter(isImageFile)
}

export function imageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return []

  const fromItems: File[] = []
  for (const item of data.items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file && isImageFile(file)) fromItems.push(file)
  }

  if (fromItems.length > 0) return fromItems
  return imageFilesFromList(data.files)
}

export function revokePhoto(photo: Photo): void {
  URL.revokeObjectURL(photo.fullUrl)
  if (photo.thumbUrl !== photo.fullUrl) URL.revokeObjectURL(photo.thumbUrl)
}

export function movePhoto(photos: Photo[], from: number, to: number): Photo[] {
  if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return photos
  const next = photos.slice()
  const [item] = next.splice(from, 1)
  if (!item) return photos
  next.splice(to, 0, item)
  return next
}

export async function loadPhotos(files: File[]): Promise<{ photos: { photo: Photo; file: File }[]; errors: string[] }> {
  const settled = await mapPool(files, 4, async (file) => {
    try {
      return { photo: await createPhoto(file), file, error: null }
    } catch {
      return { photo: null, file, error: file.name.trim() || 'файл без имени' }
    }
  })

  const photos: { photo: Photo; file: File }[] = []
  const errors: string[] = []
  for (const item of settled) {
    if (item.photo) photos.push({ photo: item.photo, file: item.file })
    if (item.error) errors.push(item.error)
  }
  return { photos, errors }
}

export async function photoFromUrl(input: { id: string; name: string; url: string }): Promise<Photo> {
  try {
    const image = await readImage(input.url, true)
    return photoFromImage(input, image, await makeThumb(image))
  } catch {
    const image = await readImage(input.url)
    return photoFromImage(input, image, input.url)
  }
}

function photoFromImage(input: { id: string; name: string; url: string }, image: HTMLImageElement, thumbUrl: string): Photo {
  if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('empty')
  return {
    id: input.id,
    name: input.name,
    fullUrl: input.url,
    thumbUrl,
    width: image.naturalWidth,
    height: image.naturalHeight
  }
}

async function createPhoto(file: File): Promise<Photo> {
  const fullUrl = URL.createObjectURL(file)
  try {
    const image = await readImage(fullUrl)
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('empty')
    const thumbUrl = await makeThumb(image)
    return {
      id: crypto.randomUUID(),
      name: file.name.trim() || 'Из буфера',
      fullUrl,
      thumbUrl,
      width: image.naturalWidth,
      height: image.naturalHeight
    }
  } catch (error) {
    URL.revokeObjectURL(fullUrl)
    throw error
  }
}

function readImage(url: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('load'))
    image.src = url
  })
}

async function makeThumb(image: HTMLImageElement): Promise<string> {
  const maxEdge = 480
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return image.src

  context.fillStyle = '#f3f0ea'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.86)
  })
  if (!blob) return image.src
  return URL.createObjectURL(blob)
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      const item = items[index]
      if (item === undefined) continue
      results[index] = await fn(item)
    }
  }

  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => run()))
  return results
}
