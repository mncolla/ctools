import { writable, derived } from 'svelte/store'
import type { UserRole } from '@shared/types'

interface AuthState {
  token: string | null
  username: string | null
  role: UserRole | null
}

function createAuthStore() {
  const stored = localStorage.getItem('auth_token')
  const storedUser = localStorage.getItem('auth_username')
  const storedRole = localStorage.getItem('auth_role') as UserRole | null

  const { subscribe, set } = writable<AuthState>({
    token: stored,
    username: storedUser,
    role: storedRole,
  })

  return {
    subscribe,
    login(token: string, username: string, role: UserRole) {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_username', username)
      localStorage.setItem('auth_role', role)
      set({ token, username, role })
    },
    logout() {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_username')
      localStorage.removeItem('auth_role')
      set({ token: null, username: null, role: null })
    },
  }
}

export const auth = createAuthStore()
export const isLoggedIn = derived(auth, ($auth) => $auth.token !== null)
