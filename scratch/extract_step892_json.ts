import fs from 'fs';
const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');
const line = lines.find(l => {
  try {
    const d = JSON.parse(l);
    return d.step_index === 892;
  } catch(e) { return false; }
});
fs.writeFileSync('scratch/step892.json', line);
