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
  const dataDir = app.getPath('userData')
  const frontendDir = getFrontendPath()

  console.log('[main:boot] Iniciando servidor')
  console.log(`[main:boot] Server path: ${serverPath}`)
  console.log(`[main:boot] Data dir: ${dataDir}`)
  console.log(`[main:boot] Frontend dir: ${frontendDir}`)

  const serverProc = utilityProcess.fork(serverPath, [], {
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      FRONTEND_DIR: frontendDir,
      PORT: '3000',
      APP_VERSION: app.getVersion(),
      JWT_SECRET: `jwt-${app.getVersion()}-${Date.now()}`,
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
  })

  serverProc.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.log('[server]', msg)
  })

  serverProc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.error('[server:err]', msg)
  })

  serverProc.on('message', (msg: { type: string; port?: number }) => {
    if (msg.type === 'ready' && msg.port) {
      console.log(`[main:ok] Servidor listo en puerto ${msg.port}`)
    }
  })

  serverProc.on('exit', (code: number) => {
    console.error(`[main:err] Servidor terminó con código ${code}`)
    if (code !== 0) {
      console.log('[main:boot] Reiniciando en 3 segundos...')
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
