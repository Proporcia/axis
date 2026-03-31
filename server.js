const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const path = require('path');

const PORT = 3000;
const IIKO_API_LOGIN = 'e2361285036e43aba84ef879bf14c59c';
const IIKO_BASE = 'api-ru.iiko.services';
const ORG_ID = 'd537096a-3641-4ea2-8733-c3a1c6088c0b';
const ROOT = '/root/axis';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
};

function httpsPost(host, p, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: host, port: 443, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}) }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getToken() {
  const r = await httpsPost(IIKO_BASE, '/api/1/access_token', { apiLogin: IIKO_API_LOGIN });
  return r.token;
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10) + ' 00:00:00.000';
}

const server = http.createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const q = url.parse(req.url, true);

  if (q.pathname === '/api/iiko') {
    try {
      const endpoint = q.query.endpoint;
      const days = parseInt(q.query.days) || 2;
      const token = await getToken();
      let result;
      if (endpoint === 'orders') {
        result = await httpsPost(IIKO_BASE, '/api/1/deliveries/by_delivery_date_and_status',
          { organizationIds: [ORG_ID], deliveryDateFrom: daysAgo(days), deliveryDateTo: daysAgo(0),
            statuses: ['Delivered', 'Closed'], maxResults: 500 }, token);
      } else if (endpoint === 'cancels') {
        result = await httpsPost(IIKO_BASE, '/api/1/deliveries/by_delivery_date_and_status',
          { organizationIds: [ORG_ID], deliveryDateFrom: daysAgo(days), deliveryDateTo: daysAgo(0),
            statuses: ['Cancelled'], maxResults: 500 }, token);
      } else if (endpoint === 'organizations') {
        result = await httpsPost(IIKO_BASE, '/api/1/organizations', { organizationIds: [] }, token);
      }
      res.writeHead(200, cors);
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(500, cors);
      res.end(JSON.stringify({ error: e.message }));
    }
  } else {
    const filePath = q.pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, q.pathname);
    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log('Axis running on port ' + PORT));
```

Сделай commit, потом в консоли:
```
curl -L -o server.js https://raw.githubusercontent.com/Proporcia/axis/main/server.js
pm2 restart server
