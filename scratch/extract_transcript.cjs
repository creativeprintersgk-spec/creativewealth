const fs = require('fs');
const readline = require('readline');

const logFile = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\8a6feee9-6a19-4ae1-b731-2dd5a081a47b\\.system_generated\\logs\\transcript.jsonl';
const outStream = fs.createWriteStream('scratch/recover_parsers.txt');

const rl = readline.createInterface({
  input: fs.createReadStream(logFile),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('parseZerodhaPdf') || line.includes('parseMiraePdf') || line.includes('parseRkGlobalPdf')) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'PLANNER_RESPONSE' && data.tool_calls) {
        for (const tc of data.tool_calls) {
           if (tc.name === 'multi_replace_file_content' || tc.name === 'write_to_file') {
             const args = tc.args;
             outStream.write('=== TOOL CALL ===\n' + JSON.stringify(args, null, 2) + '\n\n');
           }
        }
      }
    } catch(e) {}
  }
});

rl.on('close', () => {
  console.log('Done searching transcript');
  outStream.close();
});
