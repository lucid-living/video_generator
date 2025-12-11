import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from root directory to access .env.local with NEXT_PUBLIC_ variables
  const rootEnv = loadEnv(mode, process.cwd() + '/..', ['NEXT_PUBLIC_', 'VITE_'])
  const localEnv = loadEnv(mode, process.cwd(), ['NEXT_PUBLIC_', 'VITE_'])
  
  // Merge root and local env, root takes precedence
  const env = { ...localEnv, ...rootEnv }
  
  // Build define object for NEXT_PUBLIC_ variables
  const define: Record<string, string> = {}
  Object.keys(env).forEach(key => {
    if (key.startsWith('NEXT_PUBLIC_')) {
      define[`import.meta.env.${key}`] = JSON.stringify(env[key])
    }
  })
  
  return {
    plugins: [react()],
    define,
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})



