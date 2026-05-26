import { BrowserWindow, app } from 'electron'
import path from 'path'

let debugWindow: BrowserWindow | null = null

export function createDebugWindow() {
  if (debugWindow) {
    debugWindow.focus()
    return debugWindow
  }

  debugWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'preload.js'),
      sandbox: true,
    },
  })

  const debugHtmlPath = app.isPackaged
    ? path.join(process.resourcesPath, 'electron', 'debug-window.html')
    : path.join(__dirname, '../..', 'electron', 'debug-window.html')
  debugWindow.loadFile(debugHtmlPath)

  debugWindow.on('closed', () => {
    debugWindow = null
  })

  return debugWindow
}

export function closeDebugWindow() {
  if (debugWindow) {
    debugWindow.destroy()
    debugWindow = null
  }
}
