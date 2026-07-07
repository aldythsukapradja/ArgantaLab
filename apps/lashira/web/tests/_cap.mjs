import http from 'http';
import { writeFileSync } from 'fs';
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST') { let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{writeFileSync('public/farm-art/'+decodeURIComponent(req.url.slice(6)).replace(/[^a-z0-9_.]/gi,''), Buffer.from(b.replace(/^data:image\/png;base64,/,''),'base64')); console.log('wrote');}catch(e){console.log('err',e.message)} res.writeHead(200);res.end('ok'); }); return; }
  res.writeHead(404); res.end();
}).listen(7799); setTimeout(()=>process.exit(0), 300000);
