import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Desarrollo (VS Code): frontend 5174 -> backend 8000.
    // Ledger (iniciar.vbs) usa `npm run ledger`: frontend 3001 -> backend 8472.
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})