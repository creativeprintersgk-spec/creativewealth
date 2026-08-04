const fs = require('fs');
const path = require('path');

async function testApi() {
  const pdfPath = path.join(__dirname, '27-05-2026-contract-notes_VQ6949.pdf');
  const buffer = fs.readFileSync(pdfPath);
  
  try {
    const res = await fetch('http://localhost:5173/api/parse-cn', {
      method: 'POST',
      headers: {
        'x-cn-password': 'CGTPS8217E',
        'Content-Type': 'application/pdf'
      },
      body: buffer
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Error fetching:", e);
  }
}

testApi();
