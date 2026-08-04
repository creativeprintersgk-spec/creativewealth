import fs from 'fs';
import path from 'path';

async function main() {
  const logPath = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\7b02c01f-4fba-41ba-8b1c-68e01abc3140\\.system_generated\\logs\\transcript.jsonl';
  if (!fs.existsSync(logPath)) {
    console.log('Log file does not exist at:', logPath);
    return;
  }
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  console.log(`Total steps in transcript: ${lines.length}`);
  
  // Show the last 20 steps
  const last20 = lines.slice(-20);
  last20.forEach((l, i) => {
    try {
      const obj = JSON.parse(l);
      console.log(`[Step ${obj.step_index}] Source: ${obj.source}, Type: ${obj.type}`);
      if (obj.source === 'USER_EXPLICIT' || obj.type === 'USER_INPUT') {
        console.log(`  User: ${obj.content}`);
      } else if (obj.tool_calls) {
        console.log(`  Tools:`, obj.tool_calls.map((t: any) => t.name));
      }
    } catch (e) {
      console.log(`  Error parsing line:`, l.slice(0, 100));
    }
  });
}
main().catch(console.error);
