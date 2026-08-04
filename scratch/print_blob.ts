import fs from 'fs';
const data = JSON.parse(fs.readFileSync('scratch/found_blob.json', 'utf8'));
if (data.tool_calls) {
  for (const call of data.tool_calls) {
     if (call.name === 'replace_file_content' || call.name === 'write_to_file') {
        if (call.args.TargetFile && call.args.TargetFile.includes('logic.ts')) {
           fs.writeFileSync('scratch/logic_recovered.ts', call.args.CodeContent || call.args.ReplacementContent || '');
           console.log('Recovered from tool call to scratch/logic_recovered.ts');
        }
     }
  }
}
if (data.content && typeof data.content === 'string') {
  fs.writeFileSync('scratch/logic_content_recovered.ts', data.content);
  console.log('Recovered content to scratch/logic_content_recovered.ts');
}
