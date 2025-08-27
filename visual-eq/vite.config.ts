import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [],
  server: {
    port: 5173
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false
  }
})
