import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'

// A câmera só abre em contexto seguro. Em localhost funciona com http;
// para testar no celular pela rede local use `npm run dev:celular` (https autoassinado).
export default defineConfig({
  plugins: [vue(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use "@/styles/mixins" as *;`,
      },
    },
  },
})
