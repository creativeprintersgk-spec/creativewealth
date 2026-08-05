async function getGoogleFinancePrice(ticker) {
  try {
    const res = await fetch(`https://www.google.com/finance/quote/${ticker}`);
    const text = await res.text();
    const match = text.match(/class="YMlKec fxKbKc">([^<]+)<\/div>/);
    if (match) {
      console.log(`Price for ${ticker}:`, match[1].replace(/₹|,/g, ''));
    } else {
      console.log(`Price not found for ${ticker}`);
    }
  } catch (e) {
    console.error(e);
  }
}
getGoogleFinancePrice('530745:BOM');
getGoogleFinancePrice('AUROPHARMA:NSE');
