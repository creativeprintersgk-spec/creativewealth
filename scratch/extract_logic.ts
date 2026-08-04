import fs from 'fs';
const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/96c59f80-1b83-4d6f-8b38-a8276626d1ae/.system_generated/logs/transcript.jsonl', 'utf-8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'PLANNER_RESPONSE' && data.tool_calls) {
      for (const call of data.tool_calls) {
        if (call.name === 'replace_file_content' || call.name === 'write_to_file') {
           if (call.args.TargetFile && call.args.TargetFile.includes('logic.ts')) {
               fs.appendFileSync('scratch/logic_edits.log', `\n\n--- STEP ${data.step_index} ---\n${JSON.stringify(call.args, null, 2)}`);
           }
        }
      }
    }
  } catch (e) {}
}
