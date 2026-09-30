import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

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

const casParserPlugin = () => ({
  name: 'cas-parser-plugin',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/parse-cas' && req.method === 'POST') {
        const password = req.headers['x-cas-password'] || '';
        const tempId = Date.now() + '_' + Math.floor(Math.random() * 1000);
        const scratchDir = path.resolve(__dirname, 'scratch');
        const pdfPath = path.resolve(scratchDir, `cas_${tempId}.pdf`);
        const jsonPath = path.resolve(scratchDir, `cas_${tempId}.json`);
        
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir);
        }

        let body: Buffer[] = [];
        req.on('data', (chunk: Buffer) => { body.push(chunk) });
        req.on('end', () => {
          const buffer = Buffer.concat(body);
          fs.writeFileSync(pdfPath, buffer);
          
          const pythonPath = 'C:\\\\Users\\\\Admin\\\\AppData\\\\Roaming\\\\Python\\\\Python314\\\\Scripts\\\\casparser.exe';
          const command = `"${pythonPath}" -p "${password || 'DUMMY'}" -o "${jsonPath}" "${pdfPath}"`;
          
          exec(command, (error, _stdout, stderr) => {
            if (error) {
              console.error("CAS Parser error:", _stdout || stderr);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: _stdout || stderr || error.message }));
              // Clean up
              try { fs.unlinkSync(pdfPath); } catch(e){}
              return;
            }
            if (fs.existsSync(jsonPath)) {
              const data = fs.readFileSync(jsonPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              // Clean up
              try { fs.unlinkSync(pdfPath); fs.unlinkSync(jsonPath); } catch(e){}
            } else {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to generate JSON output" }));
            }
          });
        });
      } else {
        next();
      }
    });
  }
});

const cnParserPlugin = () => ({
  name: 'cn-parser-plugin',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/parse-cn' && req.method === 'POST') {
        const password = req.headers['x-cn-password'] || '';
        const brokerHint = req.headers['x-cn-broker'] || 'zerodha';
        const contentType = (req.headers['content-type'] || '').toLowerCase();
        const tempId = Date.now() + '_' + Math.floor(Math.random() * 1000);
        const scratchDir = path.resolve(__dirname, 'scratch');
        
        // Choose file extension based on content type
        let ext = '.pdf';
        if (contentType.includes('html')) ext = '.html';
        else if (contentType.includes('csv')) ext = '.csv';
        
        const filePath = path.resolve(scratchDir, `cn_${tempId}${ext}`);
        
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir);
        }

        let body: Buffer[] = [];
        req.on('data', (chunk: Buffer) => { body.push(chunk) });
        req.on('end', () => {
          const buffer = Buffer.concat(body);
          fs.writeFileSync(filePath, buffer);
          
          // Use python to run our parse_cn.py script
          const scriptPath = fs.existsSync(path.resolve(__dirname, 'scripts', 'parse_cn.py'))
            ? path.resolve(__dirname, 'scripts', 'parse_cn.py')
            : path.resolve(scratchDir, 'parse_cn.py');
          const command = `python "${scriptPath}" "${filePath}" "${password}" "${brokerHint}"`;
          
          exec(command, (error, stdout, stderr) => {
            // Always clean up the temp file
            try { fs.unlinkSync(filePath); } catch(e){}
            
            if (error) {
              console.error("CN Parser error:", stdout || stderr || error.message);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', message: stdout || stderr || error.message }));
              return;
            }
            
            // Try to parse stdout as JSON — if it fails, return raw error
            const trimmed = stdout.trim();
            try {
              JSON.parse(trimmed); // validate
              res.setHeader('Content-Type', 'application/json');
              res.end(trimmed);
            } catch (parseErr) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', message: trimmed || 'Unknown parser error' }));
            }
          });
        });
      } else {
        next();
      }
    });
  }
});

let cachedAmfiMap: any = null;
const amfiPlugin = () => ({
  name: 'amfi-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/api/amfi-isin' && req.method === 'GET') {
        try {
          if (!cachedAmfiMap) {
            const response = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
            const text = await response.text();
            const lines = text.split('\n');
            const isinMap: Record<string, {name: string, amfi_code: string}> = {};
            
            for (const line of lines) {
              const parts = line.split(';');
              if (parts.length >= 6) {
                const amfi_code = parts[0].trim();
                const isin = parts[1].trim();
                const isinReinv = parts[2].trim();
                const schemeName = parts[3].trim();
                if (isin && isin.length >= 10 && isin !== '-') {
                  isinMap[isin] = { name: schemeName, amfi_code };
                }
                if (isinReinv && isinReinv.length >= 10 && isinReinv !== '-') {
                  isinMap[isinReinv] = { name: schemeName, amfi_code };
                }
              }
            }
            cachedAmfiMap = isinMap;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(cachedAmfiMap));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({error: String(e)}));
        }
      } else {
        next();
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), localDbPlugin(), casParserPlugin(), cnParserPlugin(), amfiPlugin()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react', 'react-router-dom', '@supabase/supabase-js']
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      },
      '/api/gfinance': {
        target: 'https://www.google.com/finance/quote',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gfinance/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      '/api/mfapi': {
        target: 'https://api.mfapi.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mfapi/, '')
      },
      '/api/nse-bhavcopy': {
        target: 'https://nsearchives.nseindia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nse-bhavcopy/, '/products/content'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    }
  },
})
 
