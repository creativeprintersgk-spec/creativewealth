import fs from 'fs';
import pdf from 'pdf-parse';

const dataBuffer = fs.readFileSync('scratch/27-05-2026-contract-notes_VQ6949.pdf');
pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('scratch/pdf_text.txt', data.text);
    console.log("Done");
});
