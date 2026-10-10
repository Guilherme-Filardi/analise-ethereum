import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No dia a dia, a API (porta 8010) entrega a tela já construída (site/dist), numa janela só:
// é o abrir_site.bat. O "npm run dev" (porta 5180) é só para mexer na tela; ele repassa
// /api e /saidas para a API, que precisa estar ligada.
// Portas fora das do PAPEL (5173, 4173 e 8000), para os dois poderem ficar abertos juntos.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8010',
      '/saidas': 'http://127.0.0.1:8010',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // O Recharts pesa ~600 KB; o site roda só neste computador, então o aviso de tamanho não importa.
    chunkSizeWarningLimit: 1000,
  },
})
