import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CollageApi, UpdateStatus } from '../shared/api'

const api: CollageApi = {
  savePng: (base64, defaultName) => ipcRenderer.invoke('save-png', base64, defaultName),
  readClipboardPng: () => ipcRenderer.invoke('clipboard-png'),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  loadLibrary: () => ipcRenderer.invoke('library-load'),
  addPhotoFromPath: (photo) => ipcRenderer.invoke('library-add-path', photo),
  addPhotoFromBytes: (photo) => ipcRenderer.invoke('library-add-bytes', photo),
  removeStoredPhoto: (id) => ipcRenderer.invoke('library-remove', id),
  reorderStoredPhotos: (ids) => ipcRenderer.invoke('library-reorder', ids),
  clearStoredPhotos: () => ipcRenderer.invoke('library-clear'),
  saveLibrarySettings: (settings) => ipcRenderer.invoke('library-settings', settings),
  checkForUpdates: (manual) => ipcRenderer.invoke('update-check', manual),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateStatus: (listener) => {
    const onStatus = (_event: unknown, status: UpdateStatus) => listener(status)
    ipcRenderer.on('update-status', onStatus)
    return () => ipcRenderer.removeListener('update-status', onStatus)
  }
}

contextBridge.exposeInMainWorld('collage', api)
