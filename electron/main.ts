import { app } from 'electron'
import path from 'path'
import { createTray } from './tray'
import { setupUpdater } from './updater'

function getServerPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'index.js')
    : path.join(__dirname, '../../dist/server/index.js')
}

function getFrontendPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'frontend')
    : path.join(__dirname, '../../dist/frontend')
}

function startServer() {
  const { utilityProcess } = require('electron')
  const serverPath = getServerPath()

  const serverProc = utilityProcess.fork(serverPath, [], {
    env: {
      ...process.env,
      DATA_DIR: app.getPath('userData'),
      FRONTEND_DIR: getFrontendPath(),
      PORT: '3000',
      APP_VERSION: app.getVersion(),
      JWT_SECRET: `jwt-${app.getVersion()}-${Date.now()}`,
    },
    stdio: 'pipe',
  })

  serverProc.stdout?.on('data', (data: Buffer) => {
    console.log('[server]', data.toString().trim())
  })

  serverProc.stderr?.on('data', (data: Buffer) => {
    console.error('[server:err]', data.toString().trim())
  })

  serverProc.on('message', (msg: { type: string; port: number }) => {
    if (msg.type === 'ready') {
      console.log(`[main] Servidor listo en puerto ${msg.port}`)
    }
  })

  serverProc.on('exit', (code: number) => {
    console.error(`[main] Servidor terminó con código ${code}`)
    if (code !== 0) {
      setTimeout(startServer, 3000)
    }
  })

  return serverProc
}

app.whenReady().then(() => {
  createTray()
  startServer()
  setupUpdater()
})

app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault()
})
