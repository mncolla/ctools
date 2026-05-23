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
