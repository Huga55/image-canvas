import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/api'

function send(status: UpdateStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update-status', status)
  }
}

export function registerUpdates(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    send({ type: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    send({ type: 'not-available' })
  })
  autoUpdater.on('download-progress', (progress) => {
    send({ type: 'progress', percent: Math.max(0, Math.min(100, Math.round(progress.percent))) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    send({ type: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', () => {
    send({ type: 'error', message: 'Не удалось проверить обновление' })
  })

  ipcMain.handle('update-check', async (_event, manual: unknown) => {
    if (!app.isPackaged) {
      if (manual === true) send({ type: 'dev' })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      send({ type: 'error', message: 'Не удалось проверить обновление' })
    }
  })

  ipcMain.handle('update-download', async () => {
    if (!app.isPackaged) return
    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('update-install', () => {
    autoUpdater.quitAndInstall(true, true)
  })
}
