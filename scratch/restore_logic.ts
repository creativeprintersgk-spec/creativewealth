import fs from 'fs';
const data = JSON.parse(fs.readFileSync('scratch/step35.json', 'utf8'));

// The content starts with:
// Created At: ...
// Completed At: ...
// File Path: ...
// Total Lines: ...
// Total Bytes: ...
// Showing lines ...
// The following code has been modified ...
// 1: ...

let lines = data.content.split('\n');
let codeStarted = false;
let cleanedCode = [];

for (const line of lines) {
  if (line.match(/^\d+:/) && !codeStarted) {
    codeStarted = true;
  }
  
  if (codeStarted) {
    if (line === 'The above content shows the entire, complete file contents of the requested file.' || line === 'The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.') {
        break;
    }
    // Remove the line number prefix (e.g., "1: " or "123: ")
    const cleaned = line.replace(/^\d+:\s?/, '');
    cleanedCode.push(cleaned);
  }
}

fs.writeFileSync('src/logic.ts', cleanedCode.join('\n'));
console.log('Restored src/logic.ts');
