import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.resolve(__dirname, 'db.json')

// Simple persistence plugin for "App Folder" database
const localDbPlugin = () => ({
  name: 'local-db-plugin',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/db' && req.method === 'GET') {
        const data = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf-8') : '{}'
        res.setHeader('Content-Type', 'application/json')
        res.end(data)
      } else if (req.url === '/api/db' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => { body += chunk })
        req.on('end', () => {
          fs.writeFileSync(DB_PATH, body)
          res.end(JSON.stringify({ success: true }))
        })

      } else {
        next()
      }
    })
  }
})

export default defineConfig({
  plugins: [react(), localDbPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
