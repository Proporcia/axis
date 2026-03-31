import https from 'https';

const SERVERS = {
  proporcia: 'co-proporcia.iiko.it',
  mangal: 'proporcia-na-timiryazeva.iiko.it'
};

const TOKEN = 'e2361285036e43aba84ef879bf14c59c';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, port: 443, path, method: 'GET', headers: { 'Accept': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS });
  }

  const url = new URL(req.url);
  const server = url.searchParams.get('server') || 'proporcia';
  const endpoint = url.searchParams.get('endpoint') || 'departments';

  const host = SERVERS[server] || SERVERS.proporcia;

  const paths = {
    departments: `/resto/api/v2/corporation/departments?key=${TOKEN}`,
    orders: `/resto/api/v2/order/deliveryOrders?key=${TOKEN}&statuses=CLOSED&limit=50`,
    sales: `/resto/api/v2/reports/sales?key=${TOKEN}`,
  };

  const apiPath = paths[endpoint] || paths.departments;

  try {
    const data = await httpsGet(host, apiPath);
    return new Response(data, { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: '/api/iiko' };
