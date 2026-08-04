import fs from 'fs';
const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'PLANNER_RESPONSE' && data.tool_calls) {
       for (const call of data.tool_calls) {
           if (call.name === 'view_file' && call.args && call.args.AbsolutePath && call.args.AbsolutePath.includes('logic.ts')) {
               console.log('Found view_file call for logic.ts at step', data.step_index);
           }
       }
    }
    if (data.type === 'TOOL_RESPONSE') {
       if (data.step_index === 184 || data.step_index === 185 || data.step_index === 186 || data.step_index === 605 || data.step_index === 620) {
           console.log('Tool response keys at step', data.step_index, ':', Object.keys(data));
           if (data.responses) {
               console.log('Response keys:', Object.keys(data.responses[0]));
           }
       }
    }
  } catch (e) {}
}
