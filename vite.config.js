// The page's script, built on its own into dist/assets.
//
// The pages are drawn on the server (server/render), so the one script
// (client/main.js) only adds the games to a page that already reads well
// without it. Each game, and the 3D stadium with three.js, is loaded
// with import() only on the page that plays it, so the first script is
// small. The server reads Vite's manifest for the script's hashed name
// and serves dist/assets.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  logLevel: 'warn',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    manifest: true,
    // The preload helper would be the only thing the entry and the scene
    // share; a plain dynamic import is enough.
    modulePreload: false,
    sourcemap: false,
    target: 'es2020',
    // three.js, about 140 kB compressed, fetched only when a game opens.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: { site: fileURLToPath(new URL('./client/main.js', import.meta.url)) },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        // three.js, shared by every game played in the stadium, in a
        // chunk of its own.
        manualChunks: { three: ['three'] },
      },
    },
  },
  test: {
    include: ['client/**/*.test.js'],
    environment: 'node',
    // A moment between tests, so a long file never looks hung (see the file).
    setupFiles: ['client/testing/yield.js'],
  },
})
