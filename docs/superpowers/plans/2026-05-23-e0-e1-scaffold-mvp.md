# CTools — E0+E1: Scaffold + MVP Técnico

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold el proyecto completo (Electron + Svelte + Hono + SQLite), empaquetarlo como `.exe`, y validar la arquitectura LAN: servidor accesible desde otras PCs, pantalla de status con datos reales, backup manual a R2 y local.

**Architecture:** Electron (solo system tray) usa `utilityProcess.fork()` para correr el servidor Hono en un contexto Node.js aislado. El servidor sirve la SPA Svelte como archivos estáticos y expone una REST API bajo `/api/v1/*`. Todos los clientes acceden via browser en `http://<host-ip>:3000`. El servidor le notifica al proceso principal via IPC cuando está listo.

**Tech Stack:** Electron 36, electron-vite 3, Svelte 5, TypeScript 5, Tailwind CSS v4, Hono 4, Drizzle ORM, better-sqlite3, electron-updater, AWS SDK v3 (R2-compatible), pino, Vitest 2, svelte-spa-router

---

## Mapa de archivos

### E0 — Scaffold
| Archivo | Responsabilidad |
|---|---|
| `package.json` | Scripts de build, dependencias |
| `electron.vite.config.ts` | Build del proceso Electron main |
| `frontend/vite.config.ts` | Build de la SPA Svelte |
| `tsconfig.json` | Base TS (shared/) |
| `tsconfig.electron.json` | TS para electron/ |
| `tsconfig.server.json` | TS para server/ |
| `tsconfig.frontend.json` | TS para frontend/ |
| `electron-builder.yml` | Configuración del installer .exe |
| `.github/workflows/build.yml` | CI para generar .exe en push |
| `electron/main.ts` | Entry point Electron: fork server, tray |
| `electron/preload.ts` | Bridge mínimo renderer ↔ main |
| `server/index.ts` | Entry point servidor Hono |
| `frontend/index.html` | HTML shell para la SPA |
| `frontend/src/main.ts` | Entry point Svelte |
| `frontend/src/App.svelte` | Router raíz |
| `shared/types.ts` | DTOs compartidos server ↔ frontend |
| `resources/icon.png` | Ícono del tray (256x256) |

### E1 — MVP Técnico
| Archivo | Responsabilidad |
|---|---|
| `server/db/schema.ts` | Drizzle schema (todas las tablas) |
| `server/db/client.ts` | Instancia better-sqlite3 + WAL mode |
| `server/db/migrate.ts` | Runner de migraciones |
| `server/lib/logger.ts` | Instancia pino configurada |
| `server/routes/system.ts` | GET /health |
| `server/routes/auth.ts` | POST /auth/login (admin hardcodeado) |
| `server/routes/backup.ts` | POST /backup/trigger |
| `server/services/backup.ts` | Lógica backup local + R2 |
| `electron/tray.ts` | System tray: ícono, menú, estado |
| `electron/updater.ts` | electron-updater: check + download |
| `frontend/src/lib/api.ts` | Cliente HTTP hacia Hono |
| `frontend/src/stores/auth.ts` | Store Svelte para JWT |
| `frontend/src/routes/Status.svelte` | Pantalla de status del sistema |
| `frontend/src/routes/Login.svelte` | Pantalla de login |
| `tests/server/routes/system.test.ts` | Test: GET /health |
| `tests/server/services/backup.test.ts` | Test: backup local |

---

## Task 1: Crear estructura de proyecto e instalar dependencias (E0)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.electron.json`
- Create: `tsconfig.server.json`
- Create: `tsconfig.frontend.json`

- [ ] **Step 1: Crear package.json**

```json
{
  "name": "ctools",
  "version": "0.1.0",
  "description": "herramienta de gestión interna",
  "main": "dist/electron/main.js",
  "private": true,
  "scripts": {
    "dev:frontend": "cd frontend && vite",
    "dev:server": "tsx watch server/index.ts",
    "dev": "electron-vite dev",
    "build:frontend": "cd frontend && vite build",
    "build:server": "esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/server/index.js --external:better-sqlite3 --external:argon2",
    "build:electron": "electron-vite build",
    "build": "npm run build:frontend && npm run build:server && npm run build:electron",
    "package": "npm run build && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest",
    "postinstall": "electron-builder install-app-deps"
  }
}
```

- [ ] **Step 2: Instalar dependencias de producción**

```bash
npm install hono @hono/node-server drizzle-orm better-sqlite3 pino @aws-sdk/client-s3 electron-updater argon2 svelte-spa-router
```

- [ ] **Step 3: Instalar dependencias de desarrollo**

```bash
npm install -D electron electron-vite electron-builder @electron/rebuild vite svelte @sveltejs/vite-plugin-svelte tailwindcss @tailwindcss/vite drizzle-kit esbuild vitest tsx typescript @types/better-sqlite3 @types/node
```

- [ ] **Step 4: Crear tsconfigs**

`tsconfig.json` (base para shared/):
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

`tsconfig.electron.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist/electron"
  },
  "include": ["electron/**/*", "shared/**/*"]
}
```

`tsconfig.server.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist/server"
  },
  "include": ["server/**/*", "shared/**/*"]
}
```

`tsconfig.frontend.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["frontend/src/**/*", "shared/**/*"]
}
```

- [ ] **Step 5: Crear carpetas**

```bash
mkdir -p electron server/db server/routes server/services server/lib server/middleware frontend/src/routes frontend/src/lib frontend/src/stores shared resources tests/server/routes tests/server/services
```

---

## Task 2: Configurar electron-vite y Vite para multi-target build (E0)

**Files:**
- Create: `electron.vite.config.ts`
- Create: `frontend/vite.config.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Crear electron.vite.config.ts**

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'electron/main.ts',
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'electron/preload.ts',
      },
    },
  },
  renderer: false,
})
```

- [ ] **Step 2: Crear frontend/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 3: Crear vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
})
```

---

## Task 3: Configurar electron-builder (E0)

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Crear electron-builder.yml**

```yaml
appId: com.coppel.tools
productName: CTools
copyright: CTools

directories:
  output: release
  buildResources: resources

files:
  - dist/electron/**
  - "!dist/server/**"
  - "!dist/frontend/**"

extraResources:
  - from: dist/server
    to: server
    filter:
      - "**/*"
  - from: dist/frontend
    to: frontend
    filter:
      - "**/*"
  - from: node_modules/better-sqlite3
    to: node_modules/better-sqlite3
    filter:
      - "**/*"

win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  runAfterFinish: true

publish:
  provider: github
  owner: OWNER_PLACEHOLDER
  repo: ctools

electronVersion: "36.0.0"
```

> **Nota:** Reemplazar `OWNER_PLACEHOLDER` con tu usuario de GitHub antes de hacer release.

- [ ] **Step 2: Crear resources/icon.png placeholder**

Colocar cualquier imagen PNG de 256x256 en `resources/icon.png` e `resources/icon.ico`. Puede ser un placeholder por ahora.

```bash
# Si tenés ImageMagick instalado:
# convert -size 256x256 xc:#003366 resources/icon.png
# De lo contrario, copiá cualquier .png temporalmente
touch resources/icon.png resources/icon.ico
```

---

## Task 4: Skeleton de archivos Electron y servidor (E0)

**Files:**
- Create: `electron/preload.ts`
- Create: `electron/main.ts` (skeleton)
- Create: `server/index.ts` (skeleton)
- Create: `shared/types.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.svelte`

- [ ] **Step 1: Crear shared/types.ts**

```typescript
export interface HealthResponse {
  status: 'ok'
  version: string
  uptime: number
  lastBackupAt: number | null
  lastBackupStatus: 'success' | 'failed' | null
}

export interface BackupTriggerResponse {
  success: boolean
  localPath?: string
  r2Key?: string
  error?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
  role: 'admin' | 'supervisor' | 'empleado'
}

export type UserRole = 'admin' | 'supervisor' | 'empleado'
```

- [ ] **Step 2: Crear electron/preload.ts**

```typescript
// Preload mínimo — expande a medida que necesités comunicación tray ↔ renderer
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
})
```

- [ ] **Step 3: Crear electron/main.ts (skeleton)**

```typescript
import { app, BrowserWindow } from 'electron'
import path from 'path'

app.whenReady().then(() => {
  console.log('[main] App ready — skeleton E0')
  // Tray y servidor se agregan en Task 10
})

app.on('window-all-closed', () => {
  // No salir — la app vive en el tray
})
```

- [ ] **Step 4: Crear server/index.ts (skeleton)**

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('CTools — servidor activo'))

const PORT = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[server] Escuchando en puerto ${PORT}`)
  // Notificar al proceso padre (Electron) que el servidor está listo
  if (process.parentPort) {
    process.parentPort.postMessage({ type: 'ready', port: PORT })
  }
})
```

- [ ] **Step 5: Crear frontend/index.html**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CTools</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Crear frontend/src/main.ts**

```typescript
import App from './App.svelte'
import './app.css'

const app = new App({
  target: document.getElementById('app')!,
})

export default app
```

- [ ] **Step 7: Crear frontend/src/app.css**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Crear frontend/src/App.svelte (skeleton)**

```svelte
<script lang="ts">
  import Router from 'svelte-spa-router'
  import Status from './routes/Status.svelte'
  import Login from './routes/Login.svelte'

  const routes = {
    '/': Status,
    '/login': Login,
  }
</script>

<main class="min-h-screen bg-gray-50">
  <Router {routes} />
</main>
```

- [ ] **Step 9: Crear placeholders de rutas Svelte**

`frontend/src/routes/Status.svelte`:
```svelte
<h1 class="p-8 text-2xl font-bold">CTools — Status</h1>
```

`frontend/src/routes/Login.svelte`:
```svelte
<h1 class="p-8 text-2xl font-bold">Login</h1>
```

---

## Task 5: GitHub Actions CI (E0)

**Files:**
- Create: `.github/workflows/build.yml`

- [ ] **Step 1: Crear .github/workflows/build.yml**

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Rebuild native modules
        run: npx electron-rebuild

      - name: Build
        run: npm run build
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Package
        run: npm run package
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ctools-windows
          path: release/*.exe
```

- [ ] **Step 2: Verificar que el build de E0 funciona localmente**

```bash
npm run build:server
```

Esperado: `dist/server/index.js` creado sin errores.

```bash
npm run build:frontend
```

Esperado: `dist/frontend/` con `index.html` y assets.

```bash
npm run build:electron
```

Esperado: `dist/electron/main.js` creado.

- [ ] **Step 3: Commit E0**

```bash
git add .
git commit -m "feat: E0 - scaffold proyecto con electron-vite, Svelte, Hono y build pipeline"
```

---

## Task 6: Drizzle schema + cliente SQLite (E1)

**Files:**
- Create: `server/db/schema.ts`
- Create: `server/db/client.ts`
- Create: `server/db/migrate.ts`

- [ ] **Step 1: Crear server/db/schema.ts**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'supervisor', 'empleado'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  ipAddress: text('ip_address'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const cases = sqliteTable('cases', {
  id: text('id').primaryKey(),
  caseNumber: text('case_number').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerDni: text('customer_dni'),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  createdBy: text('created_by').references(() => users.id),
  assignedTo: text('assigned_to').references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const caseActivities = sqliteTable('case_activities', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  userId: text('user_id').references(() => users.id),
  authorLabel: text('author_label').notNull(),
  type: text('type', { enum: ['comment', 'status_change', 'assignment'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['pending', 'in_progress', 'resolved', 'cancelled'] }).notNull().default('pending'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull().default('medium'),
  visibility: text('visibility', { enum: ['all', 'roles', 'users'] }).notNull().default('all'),
  visibilityData: text('visibility_data'),
  assignedTo: text('assigned_to').references(() => users.id),
  createdBy: text('created_by').references(() => users.id),
  dueDate: integer('due_date'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const taskActivities = sqliteTable('task_activities', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  userId: text('user_id').references(() => users.id),
  fieldChanged: text('field_changed').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: integer('created_at').notNull(),
})

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  url: text('url').notNull(),
  category: text('category'),
  tags: text('tags').notNull().default('[]'),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const vaultEntries = sqliteTable('vault_entries', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  username: text('username'),
  encryptedValue: text('encrypted_value').notNull(),
  iv: text('iv').notNull(),
  notes: text('notes'),
  visibility: text('visibility', { enum: ['all', 'roles', 'users'] }).notNull().default('all'),
  visibilityData: text('visibility_data'),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  username: text('username').notNull(),
  ipAddress: text('ip_address'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
})

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
```

- [ ] **Step 2: Crear server/db/client.ts**

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = path.join(DATA_DIR, 'ctools.db')

export const sqlite = new Database(DB_PATH)

// WAL mode: mejor performance para lecturas concurrentes
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const DB_PATH_RESOLVED = DB_PATH
```

- [ ] **Step 3: Crear server/db/migrate.ts**

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { sqlite } from './client'

export const db = drizzle(sqlite)

export function runMigrations() {
  const migrationsFolder = path.join(__dirname, 'migrations')
  migrate(db, { migrationsFolder })
  console.log('[db] Migraciones aplicadas')
}
```

- [ ] **Step 4: Generar la primera migración**

Primero crear `drizzle.config.ts` en la raíz:
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
})
```

Luego generar:
```bash
npx drizzle-kit generate
```

Esperado: `server/db/migrations/0000_initial.sql` creado.

---

## Task 7: Pino logging (E1)

**Files:**
- Create: `server/lib/logger.ts`

- [ ] **Step 1: Crear server/lib/logger.ts**

```typescript
import pino from 'pino'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data')
const LOG_DIR = path.join(DATA_DIR, 'logs')

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

const LOG_FILE = path.join(LOG_DIR, 'server.log')

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  pino.destination({
    dest: LOG_FILE,
    sync: false,
  })
)

export function createRouteLogger(module: string) {
  return logger.child({ module })
}
```

---

## Task 8: Endpoint /api/v1/health + test (E1)

**Files:**
- Create: `server/routes/system.ts`
- Create: `tests/server/routes/system.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`tests/server/routes/system.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createSystemRouter } from '../../server/routes/system'

describe('GET /health', () => {
  let router: ReturnType<typeof createSystemRouter>

  beforeAll(() => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('journal_mode = WAL')
    const db = drizzle(sqlite)

    // Crear tabla system_config manualmente en memoria
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    router = createSystemRouter(db)
  })

  it('returns status ok with version and uptime', async () => {
    process.env.APP_VERSION = '0.1.0'
    const res = await router.request('/health')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.version).toBe('0.1.0')
    expect(typeof data.uptime).toBe('number')
    expect(data.lastBackupAt).toBeNull()
  })

  it('returns lastBackupAt when backup has run', async () => {
    const sqlite = new Database(':memory:')
    const db = drizzle(sqlite)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    sqlite.prepare("INSERT INTO system_config VALUES ('backup.last_success_at', '1716480000')").run()

    const r = createSystemRouter(db)
    const res = await r.request('/health')
    const data = await res.json()
    expect(data.lastBackupAt).toBe(1716480000)
    expect(data.lastBackupStatus).toBe('success')
  })
})
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
npm test
```

Esperado: FAIL — `createSystemRouter` no existe aún.

- [ ] **Step 3: Implementar server/routes/system.ts**

```typescript
import { Hono } from 'hono'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { systemConfig } from '../db/schema'
import { eq } from 'drizzle-orm'
import type { HealthResponse } from '@shared/types'

const START_TIME = Date.now()

type DB = BetterSQLite3Database<Record<string, never>>

export function createSystemRouter(db: DB) {
  const router = new Hono()

  router.get('/health', async (c) => {
    const lastSuccessAtRow = db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'backup.last_success_at'))
      .all()[0]

    const lastErrorRow = db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'backup.last_error'))
      .all()[0]

    const lastBackupAt = lastSuccessAtRow ? Number(lastSuccessAtRow.value) : null
    const lastBackupStatus = lastBackupAt
      ? 'success'
      : lastErrorRow
      ? 'failed'
      : null

    const response: HealthResponse = {
      status: 'ok',
      version: process.env.APP_VERSION ?? '0.0.0',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      lastBackupAt,
      lastBackupStatus,
    }

    return c.json(response)
  })

  return router
}
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
npm test
```

Esperado: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/routes/system.ts tests/server/routes/system.test.ts
git commit -m "feat: GET /api/v1/health endpoint con test"
```

---

## Task 9: Endpoint /api/v1/auth/login (E1)

**Files:**
- Create: `server/routes/auth.ts`

- [ ] **Step 1: Crear server/routes/auth.ts**

Este endpoint en E1 valida contra un admin hardcodeado. E2 reemplaza esto con usuarios reales de la DB.

```typescript
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { LoginResponse } from '@shared/types'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'

const BOOTSTRAP_USER = {
  username: 'admin',
  password: 'admin123',
  role: 'admin' as const,
  displayName: 'Administrador',
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export function createAuthRouter() {
  const router = new Hono()

  router.post(
    '/login',
    zValidator('json', loginSchema),
    async (c) => {
      const { username, password } = c.req.valid('json')

      if (username !== BOOTSTRAP_USER.username || password !== BOOTSTRAP_USER.password) {
        return c.json({ error: 'Credenciales inválidas' }, 401)
      }

      const now = Math.floor(Date.now() / 1000)
      const token = await sign(
        {
          userId: 'bootstrap-admin',
          username: BOOTSTRAP_USER.username,
          role: BOOTSTRAP_USER.role,
          iat: now,
          exp: now + 8 * 60 * 60,
        },
        JWT_SECRET
      )

      const response: LoginResponse = {
        token,
        username: BOOTSTRAP_USER.username,
        role: BOOTSTRAP_USER.role,
      }

      return c.json(response)
    }
  )

  return router
}
```

> **Nota:** Instalar dependencias del validator: `npm install @hono/zod-validator zod`

```bash
npm install @hono/zod-validator zod
```

---

## Task 10: Servicio de backup local + test (E1)

**Files:**
- Create: `server/services/backup.ts` (parte local)
- Create: `tests/server/services/backup.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`tests/server/services/backup.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'
import { runLocalBackup } from '../../server/services/backup'

describe('runLocalBackup', () => {
  let tmpDir: string
  let dbPath: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coppel-test-'))
    dbPath = path.join(tmpDir, 'test.db')
    const db = new Database(dbPath)
    db.exec('CREATE TABLE test (id TEXT)')
    db.close()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a backup file in the backups directory', async () => {
    const backupDir = path.join(tmpDir, 'backups')
    const result = await runLocalBackup({ dbPath, backupDir })

    expect(result.success).toBe(true)
    expect(result.localPath).toBeDefined()
    expect(fs.existsSync(result.localPath!)).toBe(true)
  })

  it('keeps only the last 7 backups', async () => {
    const backupDir = path.join(tmpDir, 'backups')
    fs.mkdirSync(backupDir)

    // Crear 8 backups viejos artificialmente
    for (let i = 0; i < 8; i++) {
      fs.writeFileSync(path.join(backupDir, `ctools-2026-01-0${i + 1}-0000.db`), '')
    }

    await runLocalBackup({ dbPath, backupDir })

    const files = fs.readdirSync(backupDir)
    expect(files.length).toBeLessThanOrEqual(7)
  })
})
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
npm test
```

Esperado: FAIL — `runLocalBackup` no existe aún.

- [ ] **Step 3: Implementar server/services/backup.ts (parte local)**

```typescript
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { promisify } from 'util'

const gzip = promisify(zlib.gzip)

interface LocalBackupOptions {
  dbPath: string
  backupDir: string
}

interface LocalBackupResult {
  success: boolean
  localPath?: string
  error?: string
}

interface R2BackupOptions {
  dbPath: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
}

interface R2BackupResult {
  success: boolean
  r2Key?: string
  error?: string
}

export async function runLocalBackup({ dbPath, backupDir }: LocalBackupOptions): Promise<LocalBackupResult> {
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16).replace('T', '-')
    const filename = `ctools-${timestamp}.db`
    const destPath = path.join(backupDir, filename)

    // SQLite hot backup — safe sin cerrar la DB
    const source = new Database(dbPath, { readonly: true })
    await source.backup(destPath)
    source.close()

    // Retener solo los últimos 7 backups
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .sort()

    if (files.length > 7) {
      const toDelete = files.slice(0, files.length - 7)
      for (const file of toDelete) {
        fs.unlinkSync(path.join(backupDir, file))
      }
    }

    return { success: true, localPath: destPath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function runR2Backup({ dbPath, bucket, accessKeyId, secretAccessKey, endpoint }: R2BackupOptions): Promise<R2BackupResult> {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    })

    const source = new Database(dbPath, { readonly: true })
    // Backup a buffer temporal en memoria
    const tmpPath = dbPath + '.backup.tmp'
    await source.backup(tmpPath)
    source.close()

    const fileBuffer = fs.readFileSync(tmpPath)
    fs.unlinkSync(tmpPath)

    const compressed = await gzip(fileBuffer)

    const now = new Date()
    const key = `backups/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/ctools-${now.toISOString().slice(0, 16).replace(':', '-')}.db.gz`

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: compressed,
        ContentType: 'application/gzip',
      })
    )

    return { success: true, r2Key: key }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
npm test
```

Esperado: PASS (2 tests de backup + 2 de health = 4 total).

- [ ] **Step 5: Commit**

```bash
git add server/services/backup.ts tests/server/services/backup.test.ts
git commit -m "feat: servicio de backup local con retención de 7 archivos"
```

---

## Task 11: Endpoint /api/v1/backup/trigger (E1)

**Files:**
- Create: `server/routes/backup.ts`

- [ ] **Step 1: Crear server/routes/backup.ts**

```typescript
import { Hono } from 'hono'
import path from 'path'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { systemConfig } from '../db/schema'
import { runLocalBackup, runR2Backup } from '../services/backup'
import { DB_PATH_RESOLVED } from '../db/client'
import type { BackupTriggerResponse } from '@shared/types'
import { createRouteLogger } from '../lib/logger'

const log = createRouteLogger('backup')

type DB = BetterSQLite3Database<Record<string, never>>

export function createBackupRouter(db: DB) {
  const router = new Hono()

  router.post('/trigger', async (c) => {
    const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data')
    const backupDir = path.join(DATA_DIR, 'backups')

    log.info('Backup manual iniciado')

    const localResult = await runLocalBackup({ dbPath: DB_PATH_RESOLVED, backupDir })

    if (!localResult.success) {
      log.error({ error: localResult.error }, 'Backup local falló')
    }

    // R2 backup — solo si están configuradas las credenciales
    const r2Configs = db.select().from(systemConfig).all()
    const configMap = Object.fromEntries(r2Configs.map((r) => [r.key, r.value]))

    let r2Result: { success: boolean; r2Key?: string; error?: string } = { success: false }

    if (configMap['backup.r2_bucket'] && configMap['backup.r2_access_key']) {
      r2Result = await runR2Backup({
        dbPath: DB_PATH_RESOLVED,
        bucket: configMap['backup.r2_bucket'],
        accessKeyId: configMap['backup.r2_access_key'],
        secretAccessKey: configMap['backup.r2_secret_key'] ?? '',
        endpoint: configMap['backup.r2_endpoint'] ?? '',
      })
    }

    const now = Math.floor(Date.now() / 1000)
    if (localResult.success || r2Result.success) {
      db.insert(systemConfig)
        .values({ key: 'backup.last_success_at', value: String(now) })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: String(now) } })
        .run()
      db.insert(systemConfig)
        .values({ key: 'backup.last_error', value: '' })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: '' } })
        .run()
    } else {
      const errorMsg = localResult.error ?? r2Result.error ?? 'Error desconocido'
      db.insert(systemConfig)
        .values({ key: 'backup.last_error', value: errorMsg })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: errorMsg } })
        .run()
    }

    const response: BackupTriggerResponse = {
      success: localResult.success || r2Result.success,
      localPath: localResult.localPath,
      r2Key: r2Result.r2Key,
      error: !localResult.success && !r2Result.success ? (localResult.error ?? r2Result.error) : undefined,
    }

    return c.json(response, response.success ? 200 : 500)
  })

  return router
}
```

---

## Task 12: Ensamblar servidor Hono completo (E1)

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Reemplazar el skeleton con el servidor completo**

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import path from 'path'
import fs from 'fs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqlite } from './db/client'
import { runMigrations } from './db/migrate'
import { createSystemRouter } from './routes/system'
import { createAuthRouter } from './routes/auth'
import { createBackupRouter } from './routes/backup'
import { logger as log } from './lib/logger'

runMigrations()

const db = drizzle(sqlite)
const app = new Hono()

app.use('*', cors({ origin: '*' }))

const api = new Hono()
api.route('/', createSystemRouter(db))
api.route('/', createAuthRouter())
api.route('/backup', createBackupRouter(db))

app.route('/api/v1', api)

const FRONTEND_DIR = process.env.FRONTEND_DIR ?? path.join(process.cwd(), 'dist/frontend')

app.use('/*', serveStatic({ root: FRONTEND_DIR }))

app.get('*', (c) => {
  const html = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf-8')
  return c.html(html)
})

const PORT = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port: PORT }, () => {
  log.info({ port: PORT }, 'Servidor iniciado')
  if (process.parentPort) {
    process.parentPort.postMessage({ type: 'ready', port: PORT })
  }
})
```

---

## Task 13: Electron main process completo (E1)

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Reemplazar skeleton con main process completo**

```typescript
import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { createTray } from './tray'
import { setupUpdater } from './updater'

let tray: Tray | null = null

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

function getDataDir(): string {
  return app.getPath('userData')
}

function startServer() {
  const { utilityProcess } = require('electron')
  const serverPath = getServerPath()

  const serverProc = utilityProcess.fork(serverPath, [], {
    env: {
      ...process.env,
      DATA_DIR: getDataDir(),
      FRONTEND_DIR: getFrontendPath(),
      PORT: '3000',
      APP_VERSION: app.getVersion(),
      JWT_SECRET: process.env.JWT_SECRET ?? `jwt-${app.getVersion()}-${Date.now()}`,
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
      tray?.setToolTip(`CTools — activo en :${msg.port}`)
    }
  })

  serverProc.on('exit', (code: number) => {
    console.error(`[main] Servidor terminó con código ${code}`)
    // Reintentar en 3 segundos si crasheó
    if (code !== 0) {
      setTimeout(startServer, 3000)
    }
  })

  return serverProc
}

app.whenReady().then(() => {
  tray = createTray()
  startServer()
  setupUpdater()
})

app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
  // La app vive en el tray — no cerrar
})
```

---

## Task 14: System tray (E1)

**Files:**
- Create: `electron/tray.ts`

- [ ] **Step 1: Crear electron/tray.ts**

```typescript
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
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })
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
      label: `Abrir en browser`,
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
```

---

## Task 15: electron-updater (E1)

**Files:**
- Create: `electron/updater.ts`

- [ ] **Step 1: Crear electron/updater.ts**

```typescript
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

  // Chequear al iniciar (si hay internet)
  autoUpdater.checkForUpdates().catch(() => {
    // Sin internet — silenciar error
  })
}
```

---

## Task 16: Frontend — API client y store de auth (E1)

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/stores/auth.ts`

- [ ] **Step 1: Crear frontend/src/lib/api.ts**

```typescript
import type { HealthResponse, BackupTriggerResponse, LoginRequest, LoginResponse } from '@shared/types'

const BASE_URL = `${window.location.protocol}//${window.location.host}/api/v1`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error ?? res.statusText)
  }

  return res.json()
}

export const api = {
  getHealth: () => request<HealthResponse>('/health'),
  login: (body: LoginRequest) =>
    request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify(body) }),
  triggerBackup: () =>
    request<BackupTriggerResponse>('/backup/trigger', { method: 'POST' }),
}
```

- [ ] **Step 2: Crear frontend/src/stores/auth.ts**

```typescript
import { writable, derived } from 'svelte/store'
import type { UserRole } from '@shared/types'

interface AuthState {
  token: string | null
  username: string | null
  role: UserRole | null
}

function createAuthStore() {
  const stored = localStorage.getItem('auth_token')
  const storedUser = localStorage.getItem('auth_username')
  const storedRole = localStorage.getItem('auth_role') as UserRole | null

  const { subscribe, set, update } = writable<AuthState>({
    token: stored,
    username: storedUser,
    role: storedRole,
  })

  return {
    subscribe,
    login(token: string, username: string, role: UserRole) {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_username', username)
      localStorage.setItem('auth_role', role)
      set({ token, username, role })
    },
    logout() {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_username')
      localStorage.removeItem('auth_role')
      set({ token: null, username: null, role: null })
    },
  }
}

export const auth = createAuthStore()
export const isLoggedIn = derived(auth, ($auth) => $auth.token !== null)
```

---

## Task 17: Pantalla de Status (E1)

**Files:**
- Modify: `frontend/src/routes/Status.svelte`

- [ ] **Step 1: Implementar Status.svelte**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { api } from '../lib/api'
  import { isLoggedIn, auth } from '../stores/auth'
  import type { HealthResponse } from '@shared/types'
  import { push } from 'svelte-spa-router'

  let health: HealthResponse | null = null
  let error = ''
  let loading = true
  let interval: ReturnType<typeof setInterval>

  const hostIP = window.location.hostname
  const port = window.location.port || '3000'

  async function fetchHealth() {
    try {
      health = await api.getHealth()
      error = ''
    } catch (e) {
      error = 'No se pudo obtener el estado del servidor'
    } finally {
      loading = false
    }
  }

  function formatDate(ts: number | null): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleString('es-AR')
  }

  async function handleBackup() {
    try {
      await api.triggerBackup()
      await fetchHealth()
    } catch (e) {
      alert('Error al ejecutar el backup')
    }
  }

  onMount(() => {
    fetchHealth()
    interval = setInterval(fetchHealth, 30_000)
  })

  onDestroy(() => clearInterval(interval))
</script>

<div class="min-h-screen bg-gray-50 p-6">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">CTools</h1>
      {#if $isLoggedIn}
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-600">{$auth.username}</span>
          <button
            on:click={() => auth.logout()}
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            Salir
          </button>
        </div>
      {:else}
        <button
          on:click={() => push('/login')}
          class="text-sm text-blue-600 hover:underline"
        >
          Iniciar sesión
        </button>
      {/if}
    </div>

    {#if loading}
      <p class="text-gray-500">Cargando...</p>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>
    {:else if health}
      <div class="bg-white rounded-lg shadow divide-y divide-gray-100">
        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Estado</span>
          <span class="flex items-center gap-2 text-green-600 font-medium">
            <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            Activo
          </span>
        </div>

        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Versión</span>
          <span class="text-sm font-mono text-gray-800">{health.version}</span>
        </div>

        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Dirección en la red</span>
          <span class="text-sm font-mono text-gray-800">{hostIP}:{port}</span>
        </div>

        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Último backup</span>
          <span class="text-sm text-gray-800">
            {#if health.lastBackupAt}
              <span class:text-green-600={health.lastBackupStatus === 'success'}
                    class:text-red-600={health.lastBackupStatus === 'failed'}>
                {formatDate(health.lastBackupAt)}
              </span>
            {:else}
              <span class="text-gray-400">Sin backups aún</span>
            {/if}
          </span>
        </div>

        {#if $isLoggedIn && $auth.role === 'admin'}
          <div class="p-4">
            <button
              on:click={handleBackup}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
            >
              Ejecutar backup ahora
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
```

---

## Task 18: Pantalla de Login (E1)

**Files:**
- Modify: `frontend/src/routes/Login.svelte`

- [ ] **Step 1: Implementar Login.svelte**

```svelte
<script lang="ts">
  import { api } from '../lib/api'
  import { auth } from '../stores/auth'
  import { push } from 'svelte-spa-router'

  let username = ''
  let password = ''
  let error = ''
  let loading = false

  async function handleSubmit() {
    if (!username || !password) return
    loading = true
    error = ''

    try {
      const res = await api.login({ username, password })
      auth.login(res.token, res.username, res.role)
      push('/')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Error al iniciar sesión'
    } finally {
      loading = false
    }
  }
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-lg shadow p-8 w-full max-w-sm">
    <h1 class="text-xl font-bold text-gray-900 mb-6">Iniciar sesión</h1>

    {#if error}
      <div class="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm mb-4">{error}</div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
        <input
          bind:value={username}
          type="text"
          autocomplete="username"
          class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
        <input
          bind:value={password}
          type="password"
          autocomplete="current-password"
          class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
      >
        {loading ? 'Ingresando...' : 'Entrar'}
      </button>
    </form>

    <p class="text-center mt-4">
      <a href="#/" class="text-sm text-blue-600 hover:underline">Volver al inicio</a>
    </p>
  </div>
</div>
```

---

## Task 19: Build final y verificación (E1)

- [ ] **Step 1: Correr todos los tests**

```bash
npm test
```

Esperado: todos los tests PASS.

- [ ] **Step 2: Build completo**

```bash
npm run build
```

Esperado: sin errores. Verificar que existen:
- `dist/frontend/index.html`
- `dist/server/index.js`
- `dist/electron/main.js`

- [ ] **Step 3: Probar el servidor en modo desarrollo**

```bash
# Terminal 1: frontend
npm run dev:frontend

# Terminal 2: servidor
node dist/server/index.js
```

Abrir `http://localhost:3000` en el browser. Debe mostrar la pantalla de status.

- [ ] **Step 4: Verificar desde otra PC en la red**

En otra PC de la misma red WiFi/LAN, abrir el browser y apuntar a `http://<ip-del-host>:3000`.

Esperado:
- Pantalla de status visible
- IP del host mostrada correctamente
- Sin errores de CORS

- [ ] **Step 5: Probar login**

Ir a `http://<ip>:3000/#/login`. Ingresar `admin` / `admin123`.

Esperado: redirige a `/`, muestra "Administrador" en el header, aparece botón de backup.

- [ ] **Step 6: Probar backup manual**

Hacer click en "Ejecutar backup ahora".

Esperado:
- El estado de último backup se actualiza en pantalla
- En `%APPDATA%/ctools/backups/` (o `.data/backups/` en dev) aparece el archivo `.db`
- Si R2 está configurado, aparece en el bucket

- [ ] **Step 7: Package como .exe (opcional en esta etapa)**

```bash
npm run package
```

Esperado: `release/CTools Setup X.X.X.exe` creado.

> Si electron-rebuild falla con better-sqlite3, correr:
> ```bash
> npx electron-rebuild -f -w better-sqlite3
> npm run package
> ```

- [ ] **Step 8: Commit final E1**

```bash
git add .
git commit -m "feat: E1 - MVP técnico completo con status page, login, backup y tray"
```

- [ ] **Step 9: Tag de versión**

```bash
git tag v0.1.0
git push origin main --tags
```

---

## Criterios de aceptación del MVP

- [ ] El `.exe` instala y levanta sin errores en Windows
- [ ] El tray icon es visible con el menú de contexto
- [ ] Desde otra PC en la red, `http://<host-ip>:3000` muestra la pantalla de status
- [ ] La pantalla de status muestra: estado activo, versión, IP del host, estado de backup
- [ ] El login con `admin` / `admin123` funciona y muestra el botón de backup
- [ ] El backup manual crea un archivo `.db` en la carpeta de backups
- [ ] Si R2 está configurado en `system_config`, el backup también sube a R2
- [ ] Los 4 tests del servidor pasan con `npm test`
