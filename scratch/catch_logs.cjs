const http = require('http');
http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    console.log('--- RECEIVED ---');
    console.log(body);
    res.end('ok');
  });
}).listen(3005, () => {
  console.log('Listening on 3005');
});
