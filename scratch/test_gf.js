fetch('http://localhost:5173/api/gfinance/530745:BOM', {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}}).then(r=>r.text()).then(t=>{ 
  console.log("HTML length:", t.length); 
  const match = t.match(/class="YMlKec fxKbKc">([^<]+)<\/div>/); 
  console.log("Match:", match ? match[1] : 'No match'); 
})
