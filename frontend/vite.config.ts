import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from root directory to access .env.local with NEXT_PUBLIC_ variables
  const rootEnv = loadEnv(mode, process.cwd() + '/..', ['NEXT_PUBLIC_', 'VITE_'])
  const localEnv = loadEnv(mode, process.cwd(), ['NEXT_PUBLIC_', 'VITE_'])
  
  // Merge root and local env, root takes precedence
  const env = { ...localEnv, ...rootEnv }
  
  // Debug: Log loaded env vars
  console.log('🔍 Vite config - Loaded VITE_API_URL:', env.VITE_API_URL || 'NOT FOUND')
  console.log('🔍 Vite config - Loaded NEXT_PUBLIC_API_URL:', env.NEXT_PUBLIC_API_URL || 'NOT FOUND')
  
  // Build define object for NEXT_PUBLIC_ variables
  const define: Record<string, string> = {}
  Object.keys(env).forEach(key => {
    if (key.startsWith('NEXT_PUBLIC_')) {
      define[`import.meta.env.${key}`] = JSON.stringify(env[key])
    }
  })
  
  // Expose VITE_ variables explicitly via define (Vite auto-loads them, but this ensures they're available)
  Object.keys(env).forEach(key => {
    if (key.startsWith('VITE_')) {
      define[`import.meta.env.${key}`] = JSON.stringify(env[key])
    }
  })
  
  return {
    plugins: [react()],
    define,
    // Explicitly set envPrefix to ensure VITE_ vars are loaded
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})



