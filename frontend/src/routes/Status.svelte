<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { api } from '../lib/api'
  import { isLoggedIn, auth } from '../stores/auth'
  import type { HealthResponse } from '@shared/types'
  import { push } from 'svelte-spa-router'

  let health: HealthResponse | null = null
  let error = ''
  let loading = true
  let interval: ReturnType<typeof setInterval>

  const hostIP = window.location.hostname
  const port = window.location.port || '3000'

  async function fetchHealth() {
    try {
      health = await api.getHealth()
      error = ''
    } catch (e) {
      error = 'No se pudo obtener el estado del servidor'
    } finally {
      loading = false
    }
  }

  function formatDate(ts: number | null): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleString('es-AR')
  }

  async function handleBackup() {
    try {
      await api.triggerBackup()
      await fetchHealth()
    } catch (e) {
      alert('Error al ejecutar el backup')
    }
  }

  onMount(() => {
    fetchHealth()
    interval = setInterval(fetchHealth, 30_000)
  })

  onDestroy(() => clearInterval(interval))
</script>

<div class="min-h-screen bg-gray-50 p-6">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">CTools</h1>
      {#if $isLoggedIn}
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-600">{$auth.username}</span>
          <button
            onclick={() => auth.logout()}
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            Salir
          </button>
        </div>
      {:else}
        <button
          onclick={() => push('/login')}
          class="text-sm text-blue-600 hover:underline"
        >
          Iniciar sesión
        </button>
      {/if}
    </div>

    {#if loading}
      <p class="text-gray-500">Cargando...</p>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>
    {:else if health}
      <div class="bg-white rounded-lg shadow divide-y divide-gray-100">
        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Estado</span>
          <span class="flex items-center gap-2 text-green-600 font-medium">
            <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            Activo
          </span>
        </div>

        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Versión</span>
          <span class="text-sm font-mono text-gray-800">{health.version}</span>
        </div>

        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Dirección en la red</span>
          <span class="text-sm font-mono text-gray-800">{hostIP}:{port}</span>
        </div>

        <div class="p-4 flex items-center justify-between">
          <span class="text-sm text-gray-500">Último backup</span>
          <span class="text-sm text-gray-800">
            {#if health.lastBackupAt}
              <span
                class:text-green-600={health.lastBackupStatus === 'success'}
                class:text-red-600={health.lastBackupStatus === 'failed'}
              >
                {formatDate(health.lastBackupAt)}
              </span>
            {:else}
              <span class="text-gray-400">Sin backups aún</span>
            {/if}
          </span>
        </div>

        {#if $isLoggedIn && $auth.role === 'admin'}
          <div class="p-4">
            <button
              onclick={handleBackup}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
            >
              Ejecutar backup ahora
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
