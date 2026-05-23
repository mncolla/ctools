import { Tray, Menu, nativeImage, shell, app } from 'electron'
import path from 'path'
import os from 'os'

function getLocalIP(): string {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

function getIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../resources/icon.png')
}

export function createTray(): Tray {
  const iconPath = getIconPath()
  let icon: Electron.NativeImage

  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }

  const tray = new Tray(icon)
  const localIP = getLocalIP()
  const url = `http://${localIP}:3000`

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `CTools v${app.getVersion()}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Abrir en browser',
      click: () => shell.openExternal(url),
    },
    {
      label: `Dirección: ${url}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => app.quit(),
    },
  ])

  tray.setToolTip('CTools — iniciando...')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => shell.openExternal(url))

  return tray
}
