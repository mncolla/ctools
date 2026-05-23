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

    const source = new Database(dbPath, { readonly: true })
    await source.backup(destPath)
    source.close()

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

    const tmpPath = `${dbPath}.backup.${Date.now()}.tmp`
    const source = new Database(dbPath, { readonly: true })
    await source.backup(tmpPath)
    source.close()

    let compressed: Buffer
    try {
      const fileBuffer = fs.readFileSync(tmpPath)
      compressed = await gzip(fileBuffer)
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath)
      }
    }

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
