# Debug Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an Electron window that displays server logs in real-time, accessible via tray menu, independent of server status.

**Architecture:** A preloaded Electron window reads the server log file (`DATA_DIR/logs/server.log`) via IPC bridge and displays it with auto-refresh every 1 second. Menu item in tray opens the window. No dependency on server running.

**Tech Stack:** Electron, IPC bridge, fs module, vanilla JS/CSS

---

## File Structure

| File | Responsibility |
|---|---|
| `electron/debug-window.html` | HTML/CSS/JS for debug UI |
| `electron/debug.ts` | Debug window creation and management |
| `electron/main.ts` (modify) | Add tray menu item |
| `electron/preload.ts` (modify) | Expose `readLogFile()` IPC method |

---

### Task 1: Create debug window HTML UI

**Files:**
- Create: `electron/debug-window.html`

- [ ] **Step 1: Create the HTML file**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CTools — Diagnóstico</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Monaco', 'Courier New', monospace;
        background: #1e1e1e;
        color: #d4d4d4;
        padding: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }

      header {
        background: #252526;
        border-bottom: 1px solid #3e3e42;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      h1 {
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .status {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 3px;
        background: #3c3c3c;
      }

      .status.ok {
        background: #4ec9b0;
        color: #1e1e1e;
      }

      .status.error {
        background: #f48771;
        color: #1e1e1e;
      }

      .controls {
        display: flex;
        gap: 8px;
      }

      button {
        background: #0e639c;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        font-family: inherit;
      }

      button:hover {
        background: #1177bb;
      }

      button:active {
        background: #0e4a7a;
      }

      main {
        flex: 1;
        overflow: auto;
        padding: 8px;
        background: #1e1e1e;
      }

      .logs {
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: 'Monaco', 'Courier New', monospace;
      }

      .log-line {
        margin: 2px 0;
      }

      .log-line.boot { color: #4fc1ff; }
      .log-line.ok { color: #4ec9b0; }
      .log-line.err { color: #f48771; }
      .log-line.migrate { color: #ce9178; }

      .empty {
        color: #858585;
        font-style: italic;
      }

      footer {
        background: #252526;
        border-top: 1px solid #3e3e42;
        padding: 8px 16px;
        font-size: 11px;
        color: #858585;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>
        <span>📋</span>
        <span>CTools Diagnóstico</span>
      </h1>
      <div class="controls">
        <button id="refresh-btn">🔄 Actualizar</button>
        <button id="clear-btn">🗑️ Limpiar</button>
      </div>
    </header>

    <main>
      <div id="logs" class="logs">
        <div class="empty">Cargando logs...</div>
      </div>
    </main>

    <footer>
      <span id="status-text">Estado: desconocido</span> •
      <span id="update-time">Última actualización: nunca</span>
    </footer>

    <script>
      const logsDiv = document.getElementById('logs')
      const statusText = document.getElementById('status-text')
      const updateTime = document.getElementById('update-time')
      const refreshBtn = document.getElementById('refresh-btn')
      const clearBtn = document.getElementById('clear-btn')

      let autoRefreshInterval = null

      async function loadLogs() {
        try {
          const content = await window.debugAPI.readLogFile()
          if (!content) {
            logsDiv.innerHTML = '<div class="empty">No hay logs aún</div>'
            statusText.textContent = 'Estado: esperando logs'
            return
          }

          const lines = content.split('\n').filter(l => l.trim())
          logsDiv.innerHTML = lines
            .map(line => {
              let className = ''
              if (line.includes('[server:boot]')) className = 'log-line boot'
              else if (line.includes('[server:ok]')) className = 'log-line ok'
              else if (line.includes('[server:err]')) className = 'log-line err'
              else if (line.includes('[db:migrate]')) className = 'log-line migrate'
              else className = 'log-line'

              return `<div class="${className}">${escapeHtml(line)}</div>`
            })
            .join('')

          logsDiv.scrollTop = logsDiv.scrollHeight
          statusText.textContent = 'Estado: OK'
          updateTime.textContent = `Última actualización: ${new Date().toLocaleTimeString()}`
        } catch (err) {
          logsDiv.innerHTML = `<div class="log-line err">Error: ${escapeHtml(err.message)}</div>`
          statusText.textContent = 'Estado: error'
        }
      }

      function escapeHtml(text) {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
      }

      refreshBtn.addEventListener('click', loadLogs)
      clearBtn.addEventListener('click', () => {
        logsDiv.innerHTML = '<div class="empty">Logs borrados (reinicia la app para ver nuevos logs)</div>'
      })

      // Initial load
      loadLogs()

      // Auto-refresh every 1 second
      autoRefreshInterval = setInterval(loadLogs, 1000)

      // Cleanup on close
      window.addEventListener('beforeunload', () => {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval)
      })
    </script>
  </body>
</html>
```

---

### Task 2: Create debug window manager

**Files:**
- Create: `electron/debug.ts`

- [ ] **Step 1: Create the debug window manager file**

```typescript
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
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
  })

  const debugHtmlPath = `file://${path.join(__dirname, '../electron/debug-window.html')}`
  debugWindow.loadURL(debugHtmlPath)

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
```

---

### Task 3: Add IPC bridge for reading logs

**Files:**
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add readLogFile IPC method to contextBridge**

Replace the entire `preload.ts` with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('debugAPI', {
  readLogFile: () => ipcRenderer.invoke('debug:read-log-file'),
})
```

---

### Task 4: Handle IPC in main process

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Add imports at the top**

After the existing imports, add:

```typescript
import fs from 'fs'
const { ipcMain } = require('electron')
```

- [ ] **Step 2: Import debug module**

Add with other imports:

```typescript
import { createDebugWindow } from './debug'
```

- [ ] **Step 3: Add IPC handler**

In `app.whenReady().then(() => {`, right after importing/declaring everything but before `createTray()`, add:

```typescript
  ipcMain.handle('debug:read-log-file', async () => {
    try {
      const logPath = path.join(app.getPath('userData'), 'logs', 'server.log')
      if (!fs.existsSync(logPath)) {
        return 'Archivo de log no encontrado'
      }
      return fs.readFileSync(logPath, 'utf-8')
    } catch (err) {
      return `Error al leer log: ${err instanceof Error ? err.message : err}`
    }
  })
```

---

### Task 5: Add menu item to tray

**Files:**
- Modify: `electron/tray.ts`

- [ ] **Step 1: Add import at top**

After existing imports:

```typescript
import { createDebugWindow } from './debug'
```

- [ ] **Step 2: Add menu item to context menu**

In the `contextMenu` array, add this item before the final separator (before "Salir"):

```typescript
    {
      label: '📋 Diagnóstico',
      click: () => createDebugWindow(),
    },
    { type: 'separator' },
```

---

### Task 6: Build, test, and commit

**Files:**
- None (verification only)

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 2: Run dev mode**

```bash
npm run dev
```

Expected: App starts, Chrome opens with Status page.

- [ ] **Step 3: Verify tray menu**

Right-click the tray icon (in taskbar).

Expected: Context menu shows "📋 Diagnóstico" option.

- [ ] **Step 4: Click Diagnóstico**

Click "📋 Diagnóstico".

Expected: New window opens with title "CTools — Diagnóstico", showing logs starting with `[server:boot]`.

- [ ] **Step 5: Verify auto-refresh**

Wait 2-3 seconds without clicking anything.

Expected: Logs update automatically (timestamps change, new lines appear).

- [ ] **Step 6: Test manual refresh**

Click "🔄 Actualizar" button.

Expected: Logs refresh immediately.

- [ ] **Step 7: Test clear button**

Click "🗑️ Limpiar" button.

Expected: Logs area shows "Logs borrados (reinicia la app para ver nuevos logs)".

- [ ] **Step 8: Close debug window and reopen**

Close the debug window. Right-click tray and click "📋 Diagnóstico" again.

Expected: New window opens and shows logs again (fresh load).

- [ ] **Step 9: Commit all changes**

```bash
git add -A
git commit -m "feat: add debug window with real-time server logs

- New 'Diagnóstico' menu item in tray
- Shows server.log with syntax highlighting
- Auto-refreshes every 1 second
- No dependency on server running
- Accessible even if server fails"
```

Expected: Commit succeeds.

