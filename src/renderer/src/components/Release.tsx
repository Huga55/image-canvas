import { useEffect, useRef, useState } from 'react'
import { APP_VERSION, CHANGELOG } from '../changelog'
import { Dialog } from './Dialog'

const dismissKey = 'holst-dismissed-update'

type Bar =
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }

export function ReleaseTools() {
  const release = useRelease()
  return (
    <>
      <div className="app-tools">
        <span className="version">{APP_VERSION}</span>
        <button type="button" className="tool" disabled={release.checking} onClick={release.check}>
          {release.checking ? 'Проверяем…' : 'Проверить'}
        </button>
        <button type="button" className="tool" onClick={() => release.setLogOpen(true)}>
          Изменения
        </button>
        {release.hint && <span className="hint tool-hint">{release.hint}</span>}
      </div>
      {release.bar && <UpdateBar bar={release.bar} onDownload={release.download} onInstall={release.install} onHide={release.hide} />}
      {release.logOpen && (
        <Dialog title="Что изменилось" onClose={() => release.setLogOpen(false)}>
          <div className="changelog">
            {CHANGELOG.map((entry) => (
              <section key={entry.version}>
                <h4>Версия {entry.version}</h4>
                <ul>
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog>
      )}
    </>
  )
}

function UpdateBar({
  bar,
  onDownload,
  onInstall,
  onHide
}: {
  bar: Bar
  onDownload: () => void
  onInstall: () => void
  onHide: () => void
}) {
  return (
    <div className="update-bar" role="status">
      {bar.kind === 'downloading' && <span className="update-progress" style={{ width: `${bar.percent}%` }} />}
      <p>
        {bar.kind === 'available' && `Доступна версия ${bar.version}`}
        {bar.kind === 'downloading' && `Скачиваем обновление · ${bar.percent}%`}
        {bar.kind === 'ready' && 'Обновление скачано'}
        {bar.kind === 'error' && bar.message}
      </p>
      <div className="update-actions">
        {bar.kind === 'available' && (
          <button type="button" className="primary" onClick={onDownload}>
            Обновить
          </button>
        )}
        {bar.kind === 'ready' && (
          <button type="button" className="primary" onClick={onInstall}>
            Установить и перезапустить
          </button>
        )}
        {bar.kind === 'available' && (
          <button type="button" onClick={onHide}>
            Скрыть
          </button>
        )}
      </div>
    </div>
  )
}

function useRelease() {
  const [bar, setBar] = useState<Bar | null>(null)
  const [checking, setChecking] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const manual = useRef(false)
  const version = useRef('')

  useEffect(() => {
    const unsubscribe = window.collage.onUpdateStatus((status) => {
      if (status.type === 'dev') {
        setChecking(false)
        if (manual.current) setHint('Проверка появится в установленной программе')
        manual.current = false
        return
      }
      if (status.type === 'available') {
        setChecking(false)
        version.current = status.version
        const dismissed = localStorage.getItem(dismissKey)
        const hidden = !manual.current && !!dismissed && !isNewer(status.version, dismissed)
        setBar(hidden ? null : { kind: 'available', version: status.version })
        manual.current = false
        return
      }
      if (status.type === 'not-available') {
        setChecking(false)
        setBar(null)
        if (manual.current) setHint('Уже стоит последняя версия')
        manual.current = false
        return
      }
      if (status.type === 'progress') {
        setBar({ kind: 'downloading', version: version.current, percent: status.percent })
        return
      }
      if (status.type === 'downloaded') {
        setChecking(false)
        version.current = status.version
        setBar({ kind: 'ready', version: status.version })
        return
      }
      setChecking(false)
      if (manual.current) setBar({ kind: 'error', message: status.message })
      manual.current = false
    })

    void window.collage.checkForUpdates(false)
    return unsubscribe
  }, [])

  const check = () => {
    manual.current = true
    setHint(null)
    setChecking(true)
    void window.collage.checkForUpdates(true)
  }

  const download = () => {
    if (bar?.kind !== 'available') return
    version.current = bar.version
    setBar({ kind: 'downloading', version: bar.version, percent: 0 })
    void window.collage.downloadUpdate()
  }

  const hide = () => {
    if (bar?.kind === 'available') localStorage.setItem(dismissKey, bar.version)
    setBar(null)
  }

  return {
    bar,
    checking,
    hint,
    logOpen,
    setLogOpen,
    check,
    download,
    install: () => void window.collage.installUpdate(),
    hide
  }
}

function isNewer(next: string, previous: string): boolean {
  const left = next.split('.').map((part) => Number(part) || 0)
  const right = previous.split('.').map((part) => Number(part) || 0)
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}
