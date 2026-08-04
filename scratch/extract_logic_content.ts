import fs from 'fs';
const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'TOOL_RESPONSE' && data.content && typeof data.content === 'string') {
       if (data.content.includes('file:///c:/Users/Admin/Desktop/wealthcore-clean/src/logic.ts') && data.content.includes('export function getStoredGroups')) {
           console.log('Found a view of logic.ts containing getStoredGroups at step', data.step_index);
           fs.writeFileSync('scratch/logic_found.txt', data.content);
           break;
       }
    }
  } catch (e) {}
}
console.log('Done scanning.');
