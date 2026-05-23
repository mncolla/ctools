import { autoUpdater } from 'electron-updater'
import { dialog, app } from 'electron'

export function setupUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización disponible',
        message: `Versión ${info.version} disponible. ¿Descargar ahora?`,
        buttons: ['Descargar', 'Más tarde'],
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Listo para instalar',
        message: 'La actualización fue descargada. La app se reiniciará para instalarla.',
        buttons: ['Reiniciar ahora'],
      })
      .then(() => {
        autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message)
  })

  autoUpdater.checkForUpdates().catch(() => {
    // No internet — silently ignore
  })
}
