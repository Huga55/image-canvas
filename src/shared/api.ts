export type SavePngResponse = { canceled: true } | { canceled: false; filePath: string }

export type LibraryPhotoInfo = {
  id: string
  name: string
  width: number
  height: number
}

export type LibrarySnapshot = {
  photos: LibraryPhotoInfo[]
  settings: unknown
}

export type StoredPhotoInput = {
  id: string
  name: string
  width: number
  height: number
}

export type UpdateStatus =
  | { type: 'dev' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

export type CollageApi = {
  savePng: (base64: string, defaultName: string) => Promise<SavePngResponse>
  readClipboardPng: () => Promise<string | null>
  pathForFile: (file: File) => string
  loadLibrary: () => Promise<LibrarySnapshot>
  addPhotoFromPath: (photo: StoredPhotoInput & { sourcePath: string }) => Promise<void>
  addPhotoFromBytes: (photo: StoredPhotoInput & { base64: string; extension: string }) => Promise<void>
  removeStoredPhoto: (id: string) => Promise<void>
  reorderStoredPhotos: (ids: string[]) => Promise<void>
  clearStoredPhotos: () => Promise<void>
  saveLibrarySettings: (settings: unknown) => Promise<void>
  checkForUpdates: (manual: boolean) => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdateStatus: (listener: (status: UpdateStatus) => void) => () => void
}
