<script lang="ts">
  import { api } from '../lib/api'
  import { auth } from '../stores/auth'
  import { push } from 'svelte-spa-router'

  let username = ''
  let password = ''
  let error = ''
  let loading = false

  async function handleSubmit() {
    if (!username || !password) return
    loading = true
    error = ''

    try {
      const res = await api.login({ username, password })
      auth.login(res.token, res.username, res.role)
      push('/')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Error al iniciar sesión'
    } finally {
      loading = false
    }
  }
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-lg shadow p-8 w-full max-w-sm">
    <h1 class="text-xl font-bold text-gray-900 mb-6">Iniciar sesión</h1>

    {#if error}
      <div class="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm mb-4">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
        <input
          bind:value={username}
          type="text"
          autocomplete="username"
          class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
        <input
          bind:value={password}
          type="password"
          autocomplete="current-password"
          class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
      >
        {loading ? 'Ingresando...' : 'Entrar'}
      </button>
    </form>

    <p class="text-center mt-4">
      <a href="/" class="text-sm text-blue-600 hover:underline">Volver al inicio</a>
    </p>
  </div>
</div>
