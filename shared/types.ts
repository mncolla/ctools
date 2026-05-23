export interface HealthResponse {
  status: 'ok'
  version: string
  uptime: number
  lastBackupAt: number | null
  lastBackupStatus: 'success' | 'failed' | null
}

export interface BackupTriggerResponse {
  success: boolean
  localPath?: string
  r2Key?: string
  error?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
  role: 'admin' | 'supervisor' | 'empleado'
}

export type UserRole = 'admin' | 'supervisor' | 'empleado'
