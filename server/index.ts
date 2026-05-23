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

runMigrations()

const db = drizzle(sqlite)
const app = new Hono()

app.use('*', cors({ origin: '*' }))

const api = new Hono()
api.route('/', createSystemRouter(db))
api.route('/', createAuthRouter())
api.route('/backup', createBackupRouter(db, DB_PATH_RESOLVED))

app.route('/api/v1', api)

const FRONTEND_DIR = process.env.FRONTEND_DIR ?? path.join(process.cwd(), 'dist/frontend')

app.use('/*', serveStatic({ root: FRONTEND_DIR }))

app.get('*', (c) => {
  const indexPath = path.join(FRONTEND_DIR, 'index.html')
  if (!fs.existsSync(indexPath)) {
    return c.text('Frontend not built yet', 503)
  }
  const html = fs.readFileSync(indexPath, 'utf-8')
  return c.html(html)
})

const PORT = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port: PORT }, () => {
  logger.info({ port: PORT }, 'Servidor iniciado')
  if (process.parentPort) {
    process.parentPort.postMessage({ type: 'ready', port: PORT })
  }
})
