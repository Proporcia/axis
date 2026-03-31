import https from 'https';

const API_LOGIN = 'e2361285036e43aba84ef879bf14c59c';
const BASE_HOST = 'api-ru.iiko.services';

// Organization IDs from iiko
const ORGS = {
  proporcia: 'd537096a-3641-4ea2-8733-c3a1c6088c0b',
  callcenter: '52ac2837-3548-4520-92ca-6cfadce8e093'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(
      { hostname: BASE_HOST, port: 443, path, method, headers },
      (res) => {
        let out = '';
        res.on('data', c => out += c);
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getToken() {
  const res = await apiRequest('POST', '/api/1/access_token', { apiLogin: API_LOGIN });
  const json = JSON.parse(res.body);
  return json.token;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 19) + '.000';
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS });

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') || 'organizations';
  const days = parseInt(url.searchParams.get('days') || '7');

  try {
    const token = await getToken();
    let result;

    if (endpoint === 'organizations') {
      result = await apiRequest('GET', '/api/1/organizations', null, token);

    } else if (endpoint === 'orders') {
      // Get orders for one org, limited period
      result = await apiRequest('POST', '/api/1/deliveries/by_delivery_date_and_status', {
        organizationIds: [ORGS.proporcia],
        deliveryDateFrom: daysAgo(days),
        deliveryDateTo: daysAgo(0),
        statuses: ['Delivered', 'Closed'],
        maxResults: 100
      }, token);

    } else if (endpoint === 'revenue') {
      // OLAP sales report for one org
      const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const dateTo = new Date().toISOString().slice(0, 10);

      result = await apiRequest('POST', '/api/1/reports/olap', {
        organizationId: ORGS.proporcia,
        settings: {
          reportType: 'SALES',
          buildSummary: true,
          groupByRowFields: ['OpenDate.Typed'],
          aggregateFields: ['DishSumInt', 'OrderNum'],
          filters: {
            'OpenDate.Typed': {
              filterType: 'DateRange',
              periodType: 'CUSTOM',
              from: dateFrom,
              to: dateTo,
              includeLow: true,
              includeHigh: true
            }
          }
        }
      }, token);

    } else if (endpoint === 'cancels') {
      result = await apiRequest('POST', '/api/1/deliveries/by_delivery_date_and_status', {
        organizationIds: [ORGS.proporcia],
        deliveryDateFrom: daysAgo(days),
        deliveryDateTo: daysAgo(0),
        statuses: ['Cancelled'],
        maxResults: 100
      }, token);
    }

    return new Response(result?.body || '{}', { status: result?.status || 200, headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: '/api/iiko' };
