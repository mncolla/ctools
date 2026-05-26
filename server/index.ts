import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import path from 'path'
import fs from 'fs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqlite, DB_PATH_RESOLVED } from './db/client'
import { runMigrations } from './db/migrate'
import { createSystemRouter } from './routes/system'
import { createAuthRouter } from './routes/auth'
import { createBackupRouter } from './routes/backup'
import { logger } from './lib/logger'

const PORT = Number(process.env.PORT ?? 3000)

console.log('[server:boot] Iniciando servidor Node')
console.log('[server:boot] Node version:', process.version)
console.log('[server:boot] Puerta:', PORT)
console.log('[server:boot] Data dir:', process.env.DATA_DIR)
console.log('[server:boot] Frontend dir:', process.env.FRONTEND_DIR)

try {
  console.log('[server:boot] Ejecutando migraciones...')
  runMigrations()
  console.log('[server:boot] Migraciones completadas')
} catch (err) {
  console.error('[server:err] Error en migraciones:', err instanceof Error ? err.message : err)
  process.exit(1)
}

try {
  console.log('[server:boot] Inicializando Drizzle ORM...')
  const db = drizzle(sqlite)
  console.log('[server:boot] Drizzle inicializado')

  const app = new Hono()
  app.use('*', cors({ origin: '*' }))

  console.log('[server:boot] Configurando rutas...')
  const api = new Hono()
  api.route('/', createSystemRouter(db))
  api.route('/', createAuthRouter())
  api.route('/backup', createBackupRouter(db, DB_PATH_RESOLVED))
  app.route('/api/v1', api)
  console.log('[server:boot] Rutas configuradas')

  const FRONTEND_DIR = process.env.FRONTEND_DIR ?? path.join(process.cwd(), 'dist/frontend')
  console.log('[server:boot] Frontend dir:', FRONTEND_DIR)
  console.log('[server:boot] Frontend existe:', fs.existsSync(FRONTEND_DIR))

  app.use('/*', serveStatic({ root: FRONTEND_DIR }))
  app.get('*', (c) => {
    const indexPath = path.join(FRONTEND_DIR, 'index.html')
    if (!fs.existsSync(indexPath)) {
      return c.text('Frontend not built yet', 503)
    }
    const html = fs.readFileSync(indexPath, 'utf-8')
    return c.html(html)
  })

  console.log('[server:boot] Iniciando servidor HTTP...')
  serve({ fetch: app.fetch, port: PORT }, () => {
    logger.info({ port: PORT }, 'Servidor iniciado')
    console.log(`[server:ok] Escuchando en puerto ${PORT}`)
    if (process.parentPort) {
      process.parentPort.postMessage({ type: 'ready', port: PORT })
    }
  })
} catch (err) {
  console.error('[server:err] Error fatal:', err instanceof Error ? err.stack : err)
  process.exit(1)
}
