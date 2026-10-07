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
let cachedNseMap: any = null;
let cachedNseDebtMap: any = null;
let cachedMergedBhavMap: any = null;
let lastBhavFetchTime = 0;
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
            
            let currentCategory = '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.includes('Schemes(') || trimmed.startsWith('Open Ended') || trimmed.startsWith('Close Ended') || trimmed.startsWith('Interval Fund')) {
                currentCategory = trimmed;
                continue;
              }

              const parts = trimmed.split(';');
              if (parts.length >= 6) {
                const amfi_code = parts[0].trim();
                const isin = parts[1].trim();
                const isinReinv = parts[2].trim();
                const schemeName = parts[3].trim();

                const catLower = currentCategory.toLowerCase();
                let taxCategory: 'EQUITY' | 'DEBT_SEC50AA' | 'HYBRID_OTHER' = 'EQUITY';
                if (catLower.includes('debt') || catLower.includes('liquid') || catLower.includes('money market') || catLower.includes('income')) {
                  taxCategory = 'DEBT_SEC50AA';
                } else if (catLower.includes('hybrid') || catLower.includes('multi asset') || catLower.includes('fund of fund') || catLower.includes('fof')) {
                  taxCategory = 'HYBRID_OTHER';
                }

                const schemeInfo = {
                  name: schemeName,
                  amfi_code,
                  category: currentCategory,
                  taxCategory
                };

                if (isin && isin.length >= 10 && isin !== '-') {
                  isinMap[isin] = schemeInfo;
                }
                if (isinReinv && isinReinv.length >= 10 && isinReinv !== '-') {
                  isinMap[isinReinv] = schemeInfo;
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
      } else if (req.url === '/api/nse-isin' && req.method === 'GET') {
        try {
          if (!cachedNseMap) {
            const response = await fetch('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv', {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const text = await response.text();
            const lines = text.split('\n');
            const nseMap: Record<string, { symbol: string; name: string; series: string }> = {};
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',');
              if (parts.length >= 7) {
                const isin = parts[6].trim();
                const symbol = parts[0].trim();
                const name = parts[1].trim();
                const series = parts[2].trim();
                if (isin && isin.startsWith('IN')) {
                  nseMap[isin] = { symbol, name, series };
                }
              }
            }
            cachedNseMap = nseMap;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(cachedNseMap));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({error: String(e)}));
        }
      } else if (req.url === '/api/nse-debt-isin' && req.method === 'GET') {
        try {
          if (!cachedNseDebtMap) {
            const response = await fetch('https://nsearchives.nseindia.com/content/equities/DEBT.csv', {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const text = await response.text();
            const lines = text.split('\n');
            const debtMap: Record<string, any> = {};
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              const parts = line.split(',');
              if (parts.length >= 10) {
                const isin = parts.find(p => /^IN[A-Z0-9]{10}$/.test(p.trim()));
                if (isin) {
                  const redDate = parts[9]?.trim() || '';
                  let formattedDate = redDate;
                  const dateM = redDate.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
                  if (dateM) {
                    const months: Record<string, string> = {
                      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
                      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
                    };
                    const mStr = months[dateM[2].toUpperCase()] || '01';
                    formattedDate = `${dateM[3]}-${mStr}-${dateM[1].padStart(2, '0')}`;
                  }

                  const ipRate = parseFloat(parts[6]?.trim() || '0');

                  debtMap[isin.trim()] = {
                    symbol: parts[0]?.trim(),
                    name: parts[1]?.trim(),
                    series: parts[2]?.trim(),
                    faceValue: Number(parts[3]?.trim()) || 1000,
                    couponRate: ipRate > 0 ? ipRate : undefined,
                    maturityDate: formattedDate || undefined,
                    interestFrequency: 'Annual',
                    bondCategory: 'ncd'
                  };
                }
              }
            }
            cachedNseDebtMap = debtMap;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(cachedNseDebtMap));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      } else if (req.url === '/api/nse-bhavcopy-merged' && req.method === 'GET') {
        try {
          const NOW = Date.now();
          if (!cachedMergedBhavMap || (NOW - lastBhavFetchTime > 30 * 60 * 1000)) {
            const merged: Record<string, { price: number; prevClose: number; date: string; series: string }> = {};
            const pad = (n: number) => n.toString().padStart(2, '0');
            const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
            let daysFetched = 0;

            for (let i = 0; i < 30 && daysFetched < 15; i++) {
              const d = new Date(nowIST.getTime() - i * 24 * 60 * 60 * 1000);
              const dayOfWeek = d.getUTCDay();
              if (dayOfWeek === 0 || dayOfWeek === 6) continue;
              const dateStr = `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
              const url = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dateStr}.csv`;
              try {
                const response = await fetch(url, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                if (response.ok) {
                  const text = await response.text();
                  const lines = text.split('\n');
                  daysFetched++;
                  for (let j = 1; j < lines.length; j++) {
                    const line = lines[j].trim();
                    if (!line) continue;
                    const parts = line.split(',');
                    if (parts.length >= 9) {
                      const sym = parts[0].trim();
                      const series = parts[1]?.trim() || '';
                      const dateVal = parts[2]?.trim() || '';
                      const prev = parseFloat(parts[3]?.trim());
                      const close = parseFloat(parts[8]?.trim());
                      if (sym && !isNaN(close) && close > 0 && !merged[sym]) {
                        merged[sym] = {
                          price: close,
                          prevClose: isNaN(prev) ? close : prev,
                          date: dateVal,
                          series
                        };
                      }
                    }
                  }
                }
              } catch (e) {}
            }
            if (Object.keys(merged).length > 0) {
              cachedMergedBhavMap = merged;
              lastBhavFetchTime = NOW;
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(cachedMergedBhavMap || {}));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
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
    port: 5173, allowedHosts: true,
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
 
