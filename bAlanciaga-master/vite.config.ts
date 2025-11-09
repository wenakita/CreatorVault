import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      __GRAPH_API_KEY__: JSON.stringify(env.NEXT_PUBLIC_GRAPH_API_KEY)
    }
  }
})
