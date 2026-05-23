import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createSystemRouter } from '../../../server/routes/system'

describe('GET /health', () => {
  let router: ReturnType<typeof createSystemRouter>

  beforeAll(() => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('journal_mode = WAL')
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    const db = drizzle(sqlite)
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
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    sqlite.prepare("INSERT INTO system_config VALUES ('backup.last_success_at', '1716480000')").run()
    const db = drizzle(sqlite)
    const r = createSystemRouter(db)
    const res = await r.request('/health')
    const data = await res.json()
    expect(data.lastBackupAt).toBe(1716480000)
    expect(data.lastBackupStatus).toBe('success')
  })
})
