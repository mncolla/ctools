<script lang="ts">
  import Router from 'svelte-spa-router'
  import Status from './routes/Status.svelte'
  import Login from './routes/Login.svelte'

  const routes = {
    '/': Status,
    '/login': Login,
  }
</script>

<main class="min-h-screen bg-gray-50">
  <Router {routes} />
</main>
