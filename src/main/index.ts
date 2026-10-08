import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, protocol, shell } from 'electron'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createLibrary, type NewLibraryPhoto } from './library'
import { registerUpdates } from './updates'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'collage',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
])

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.whenReady().then(() => {
    const library = createLibrary(join(app.getPath('userData'), 'library'))
    protocol.handle('collage', (request) => library.respond(request))
    registerIpc(library)
    registerUpdates()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function windowIcon(): string | undefined {
  const candidates = [join(process.cwd(), 'resources/icon.png'), join(app.getAppPath(), 'resources/icon.png')]
  return candidates.find((path) => existsSync(path))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'Холст',
    icon: windowIcon(),
    backgroundColor: '#e6e1d8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(library: ReturnType<typeof createLibrary>): void {
  ipcMain.handle('library-load', () => library.load())
  ipcMain.handle('library-add-path', (_event, photo: NewLibraryPhoto) => library.addFromPath(photo))
  ipcMain.handle('library-add-bytes', (_event, photo: NewLibraryPhoto) => library.addFromBytes(photo))
  ipcMain.handle('library-remove', (_event, id: string) => library.remove(id))
  ipcMain.handle('library-reorder', (_event, ids: string[]) => library.reorder(ids))
  ipcMain.handle('library-clear', () => library.clear())
  ipcMain.handle('library-settings', (_event, settings: unknown) => library.saveSettings(settings))

  ipcMain.handle('clipboard-png', async () => {
    const items = await clipboard.read()
    for (const item of items) {
      const type = item.types.find((entry) => entry.startsWith('image/'))
      if (!type) continue
      const payload = await item.getType(type)
      if (!(payload instanceof Blob)) continue
      const image = nativeImage.createFromBuffer(Buffer.from(await payload.arrayBuffer()))
      if (image.isEmpty()) continue
      return image.toPNG().toString('base64')
    }
    return null
  })

  ipcMain.handle('save-png', async (event, base64: unknown, defaultName: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const bytes = decodePng(base64)
    const fileName = safeFileName(defaultName)
    const dialogOptions = {
      title: 'Сохранить коллаж',
      defaultPath: fileName,
      filters: [{ name: 'PNG', extensions: ['png'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, dialogOptions) : await dialog.showSaveDialog(dialogOptions)

    if (result.canceled || !result.filePath) return { canceled: true }
    await writeFile(result.filePath, bytes)
    return { canceled: false, filePath: result.filePath }
  })
}

function decodePng(base64: unknown): Buffer {
  if (typeof base64 !== 'string' || base64.length === 0 || base64.length > 120_000_000) {
    throw new Error('Некорректное изображение')
  }

  const bytes = Buffer.from(base64, 'base64')
  const pngSignature = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!pngSignature) throw new Error('Некорректное изображение')
  return bytes
}

function safeFileName(name: unknown): string {
  const fallback = 'коллаж.png'
  if (typeof name !== 'string') return fallback
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim()
  if (!cleaned.toLowerCase().endsWith('.png')) return fallback
  return cleaned.slice(0, 180)
}
