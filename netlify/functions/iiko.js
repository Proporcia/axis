import https from 'https';

const API_LOGIN = 'e2361285036e43aba84ef879bf14c59c';
const BASE_HOST = 'api-ru.iiko.services';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
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
  const res = await request('POST', '/api/1/access_token', { apiLogin: API_LOGIN });
  const json = JSON.parse(res.body);
  return json.token;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS });

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') || 'organizations';

  try {
    // Step 1: get access token
    const token = await getToken();

    let result;

    if (endpoint === 'organizations') {
      // Get organizations list
      result = await request('GET', '/api/1/organizations', null, token);

    } else if (endpoint === 'orders') {
      // Get delivery orders for last 7 days
      const orgRes = await request('GET', '/api/1/organizations', null, token);
      const orgs = JSON.parse(orgRes.body);
      const orgIds = orgs.organizations?.map(o => o.id) || [];

      const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + '.000';
      const dateTo = new Date().toISOString().slice(0, 19) + '.000';

      result = await request('POST', '/api/1/deliveries/by_delivery_date_and_status', {
        organizationIds: orgIds,
        deliveryDateFrom: dateFrom,
        deliveryDateTo: dateTo,
        statuses: ['Delivered', 'Closed']
      }, token);

    } else if (endpoint === 'revenue') {
      // Get olap sales report
      const orgRes = await request('GET', '/api/1/organizations', null, token);
      const orgs = JSON.parse(orgRes.body);
      const orgId = orgs.organizations?.[0]?.id;

      const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const dateTo = new Date().toISOString().slice(0, 10);

      result = await request('POST', '/api/1/reports/olap', {
        organizationId: orgId,
        settings: {
          reportType: 'SALES',
          buildSummary: true,
          groupByRowFields: ['OpenDate.Typed'],
          aggregateFields: ['DishSumInt', 'OrderNum', 'GuestNum'],
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
    }

    return new Response(result?.body || '{}', {
      status: result?.status || 200,
      headers: CORS
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: CORS
    });
  }
};

export const config = { path: '/api/iiko' };
