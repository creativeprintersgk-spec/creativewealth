import fs from 'fs';

const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    // Find the view_file result for logic.ts from early steps
    if (data.type === 'TOOL_RESPONSE' && data.tool_name === 'view_file' && data.content && typeof data.content === 'string') {
       if (data.content.includes('logic.ts') && data.content.includes('acmac1')) {
           console.log('Found logic.ts view at step', data.step_index);
           fs.writeFileSync('scratch/logic_view.log', data.content);
           break;
       }
    }
  } catch (e) {}
}
console.log('Done scanning transcript for view_file.');
