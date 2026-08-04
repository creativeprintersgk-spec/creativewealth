const fs = require('fs');

const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/b8574ae2-8ca9-4b84-af80-04e987c74bcc/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
let fullContent = '';

for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const entry = JSON.parse(lines[i]);
    if (entry.type === 'PLANNER_RESPONSE' && entry.status === 'DONE') continue;
    if (entry.content && entry.content.includes('hasStaged')) {
       fullContent += '\n\n--- MATCH ---\n' + entry.content;
    }
  } catch (e) {}
}

fs.writeFileSync('scratch/import_page_cats.txt', fullContent);
