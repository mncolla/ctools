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
