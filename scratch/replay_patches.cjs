const fs = require('fs');

const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/b8574ae2-8ca9-4b84-af80-04e987c74bcc/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
let logic = fs.readFileSync('src/logic.ts', 'utf8');

let applied = 0;
for (let l of lines) {
  try {
    const obj = JSON.parse(l);
    if (obj.tool_calls && obj.tool_calls[0].name === 'replace_file_content' && obj.tool_calls[0].args.TargetFile.includes('logic.ts')) {
      const args = obj.tool_calls[0].args;
      const target = args.TargetContent;
      const replacement = args.ReplacementContent;
      
      if (logic.includes(target)) {
        logic = logic.replace(target, replacement);
        applied++;
        console.log('Applied patch', applied);
      } else {
        console.log('Target not found for patch', applied + 1);
      }
    }
    
    if (obj.tool_calls && obj.tool_calls[0].name === 'multi_replace_file_content' && obj.tool_calls[0].args.TargetFile.includes('logic.ts')) {
      const chunks = obj.tool_calls[0].args.ReplacementChunks;
      for (const chunk of chunks) {
        if (logic.includes(chunk.TargetContent)) {
          logic = logic.replace(chunk.TargetContent, chunk.ReplacementContent);
          applied++;
          console.log('Applied multi-patch', applied);
        } else {
          console.log('Target not found for multi-patch', applied + 1);
        }
      }
    }
  } catch(e) {}
}

console.log('Total patches applied:', applied);
fs.writeFileSync('scratch/logic_rebuilt.ts', logic);
