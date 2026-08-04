import fs from 'fs';
import * as pdf from 'pdf-parse';

const dataBuffer = fs.readFileSync('scratch/27-05-2026-contract-notes_VQ6949.pdf');
pdf.default(dataBuffer).then(function(data) {
    fs.writeFileSync('scratch/pdf_text.txt', data.text);
    console.log("Done");
}).catch(e => console.log(e));
