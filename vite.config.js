import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // server: {
  //   port: 4000, // 👈 Change this to your desired port
  //   open: true  // Optional: automatically open browser on start
  // }
   server: {
    host: true,
    port: 3002,
    // allowedHosts: ['mpslocappsvr.something.com']
  }
})
