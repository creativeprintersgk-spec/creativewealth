const fs = require('fs');

const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/b8574ae2-8ca9-4b84-af80-04e987c74bcc/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const entry = JSON.parse(lines[i]);
    if (entry.tool_calls) {
      for (const call of entry.tool_calls) {
        if (call.args && typeof call.args === 'object') {
          for (const key in call.args) {
             const val = String(call.args[key]);
             if (val.includes('startImport') && !val.includes('find_tool_call.cjs') && !val.includes('transcript.jsonl')) {
                console.log('FOUND startImport AT STEP', entry.step_index);
             }
          }
        }
      }
    }
  } catch (e) {}
}
