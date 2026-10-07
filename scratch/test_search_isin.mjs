import fs from 'fs';

const isin = 'INE549K07HI2';
const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(isin), {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});
const text = await res.text();
const matches = [...text.matchAll(/class="result__snippet"[^>]*>(.*?)<\/a>/gs)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
console.log('Results:', matches.slice(0, 3));
