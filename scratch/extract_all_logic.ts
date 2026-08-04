import fs from 'fs';
const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'VIEW_FILE') {
       if (typeof data.content === 'string' && data.content.includes('logic.ts')) {
           fs.writeFileSync(`scratch/logic_step_${data.step_index}.txt`, data.content);
           console.log('Saved step', data.step_index);
       }
    }
  } catch (e) {}
}
