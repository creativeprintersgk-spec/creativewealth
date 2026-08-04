const fs = require('fs');

const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/b8574ae2-8ca9-4b84-af80-04e987c74bcc/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i]) continue;
  try {
    const entry = JSON.parse(lines[i]);
    if (entry.tool_calls) {
      for (const call of entry.tool_calls) {
        if (call.name === 'write_to_file' || call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') {
          if (call.args.TargetFile && call.args.TargetFile.includes('ImportPage.tsx')) {
             console.log('Found edit to ImportPage at step', entry.step_index);
          }
        }
      }
    }
  } catch (e) {}
}
