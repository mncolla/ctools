import type { HealthResponse, BackupTriggerResponse, LoginRequest, LoginResponse } from '@shared/types'

const BASE_URL = `${window.location.protocol}//${window.location.host}/api/v1`

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error ?? res.statusText)
  }

  return res.json()
}

export const api = {
  getHealth: () => request<HealthResponse>('/health'),
  login: (body: LoginRequest) =>
    request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify(body) }),
  triggerBackup: () =>
    request<BackupTriggerResponse>('/backup/trigger', { method: 'POST' }),
}
