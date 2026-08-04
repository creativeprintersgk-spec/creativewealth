import fs from 'fs';
const data = JSON.parse(fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n').find(line => {
  try {
    const d = JSON.parse(line);
    return d.step_index === 35 && d.type === 'TOOL_RESPONSE';
  } catch(e) { return false; }
}));
fs.writeFileSync('scratch/logic_full_step35.ts', data.content);
