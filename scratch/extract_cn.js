const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function run() {
  const data = new Uint8Array(fs.readFileSync('scratch/27-05-2026-contract-notes_VQ6949.pdf'));
  const loadingTask = pdfjsLib.getDocument({
    data,
    password: 'CGTPS8217E'
  });
  const pdf = await loadingTask.promise;
  console.log('Number of pages:', pdf.numPages);
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let lastY = null;
    let pageText = '';
    for (const item of textContent.items) {
      if (!item.str.trim()) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        pageText += '\n';
      }
      pageText += item.str + ' ';
      lastY = y;
    }
    fullText += pageText + '\n';
  }
  fs.writeFileSync('scratch/extracted_cn_text.txt', fullText);
  console.log('Done!');
}
run().catch(console.error);
