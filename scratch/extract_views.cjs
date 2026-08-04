const fs = require('fs');

const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/b8574ae2-8ca9-4b84-af80-04e987c74bcc/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
let fullContent = '';

for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const entry = JSON.parse(lines[i]);
    if (entry.type === 'VIEW_FILE' && entry.content && entry.content.includes('ImportPage.tsx')) {
       fullContent += '\n\n--- VIEW_FILE Output ---\n' + entry.content;
    }
  } catch (e) {}
}

fs.writeFileSync('scratch/import_page_views.txt', fullContent);
