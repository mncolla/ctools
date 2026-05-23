import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/electron',
      lib: {
        entry: 'electron/main.ts',
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/electron/preload',
      lib: {
        entry: 'electron/preload.ts',
      },
    },
  },
  // renderer is intentionally omitted: the frontend is a Svelte SPA served by
  // Hono and accessed via browser. Electron only manages the system tray.
})
