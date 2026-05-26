import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import fs from 'fs'
import { sqlite } from './client'

export const db = drizzle(sqlite)

export function runMigrations() {
  const migrationsFolder = path.join(__dirname, 'migrations')
  console.log('[db:migrate] Carpeta de migraciones:', migrationsFolder)
  console.log('[db:migrate] Existe:', fs.existsSync(migrationsFolder))
  if (fs.existsSync(migrationsFolder)) {
    const files = fs.readdirSync(migrationsFolder)
    console.log('[db:migrate] Archivos encontrados:', files)
  }
  try {
    migrate(db, { migrationsFolder })
    console.log('[db:migrate] Migraciones aplicadas exitosamente')
  } catch (err) {
    console.error('[db:migrate] Error:', err instanceof Error ? err.message : err)
    throw err
  }
}
