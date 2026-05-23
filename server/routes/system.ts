import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { systemConfig } from '../db/schema'
import type { HealthResponse } from '@shared/types'

const START_TIME = Date.now()

type DB = BetterSQLite3Database<Record<string, never>>

export function createSystemRouter(db: DB) {
  const router = new Hono()

  router.get('/health', (c) => {
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
    const lastBackupStatus: HealthResponse['lastBackupStatus'] = lastBackupAt
      ? 'success'
      : lastErrorRow?.value
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
