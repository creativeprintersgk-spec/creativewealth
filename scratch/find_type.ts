import fs from 'fs';
const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');

for (const line of lines) {
  if (line.includes("safeFetch('acmac1')")) {
    try {
      const data = JSON.parse(line);
      console.log('Found in type:', data.type, 'source:', data.source);
      fs.writeFileSync('scratch/found_type.json', JSON.stringify(data, null, 2));
      break;
    } catch(e) {}
  }
}
