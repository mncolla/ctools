import { Hono } from 'hono'
import path from 'path'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { systemConfig } from '../db/schema'
import { runLocalBackup, runR2Backup } from '../services/backup'
import type { BackupTriggerResponse } from '@shared/types'
import { createRouteLogger } from '../lib/logger'

const log = createRouteLogger('backup')

type DB = BetterSQLite3Database<Record<string, never>>

export function createBackupRouter(db: DB, dbPath: string) {
  const router = new Hono()

  router.post('/trigger', async (c) => {
    const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data')
    const backupDir = path.join(DATA_DIR, 'backups')

    log.info('Backup manual iniciado')

    const localResult = await runLocalBackup({ dbPath: dbPath, backupDir })

    if (!localResult.success) {
      log.error({ error: localResult.error }, 'Backup local falló')
    }

    const r2Configs = db.select().from(systemConfig).all()
    const configMap = Object.fromEntries(r2Configs.map((r) => [r.key, r.value]))

    let r2Result: { success: boolean; r2Key?: string; error?: string } = { success: false }

    if (configMap['backup.r2_bucket'] && configMap['backup.r2_access_key']) {
      r2Result = await runR2Backup({
        dbPath: dbPath,
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
      error: !localResult.success && !r2Result.success
        ? (localResult.error ?? r2Result.error)
        : undefined,
    }

    return c.json(response, response.success ? 200 : 500)
  })

  return router
}
