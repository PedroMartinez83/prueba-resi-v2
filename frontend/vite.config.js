import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },

  preview:{
    host: true,
    port: 4173,
    allowedHosts: ['automanagersistema.com', 'www.automanagersistema.com'],
  },
  
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        // 🔥 AGREGADO: Timeouts para archivos grandes
        timeout: 120000, // 2 minutos
        proxyTimeout: 120000,
        // 🔥 AGREGADO: Configuración de eventos del proxy
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 Proxy request:', req.method, req.url);
            
            if (req.headers['content-type']?.includes('multipart/form-data')) {
              console.log('📎 Detectado multipart/form-data');
            }
          });

          proxy.on('error', (err, req, res) => {
            console.error('❌ Proxy error:', err);
          });
        }
      }
    }
  }
})
