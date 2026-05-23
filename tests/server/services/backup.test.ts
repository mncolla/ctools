import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'
import { runLocalBackup } from '../../../server/services/backup'

describe('runLocalBackup', () => {
  let tmpDir: string
  let dbPath: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctools-test-'))
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
    for (let i = 0; i < 8; i++) {
      fs.writeFileSync(path.join(backupDir, `ctools-2026-01-0${i + 1}-0000.db`), '')
    }
    await runLocalBackup({ dbPath, backupDir })
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'))
    expect(files.length).toBeLessThanOrEqual(7)
  })
})
