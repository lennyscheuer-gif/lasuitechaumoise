const https = require('https');

const PRICELABS_API_KEY = process.env.PRICELABS_API_KEY;
const LISTING_ID = '11854001___1185400101';
const MARKUP = 1.15;

function fetchPriceLabs(path, method, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.pricelabs.co',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PRICELABS_API_KEY,
      }
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

exports.handler = async function(event, context) {
  try {
    // Essayer plusieurs endpoints PriceLabs
    const endpoints = [
      { path: `/v1/listing_prices?listing_id=${LISTING_ID}`, method: 'GET', body: null },
      { path: '/v1/listing_prices', method: 'POST', body: { listing_id: LISTING_ID } },
      { path: `/v1/prices?listing_id=${LISTING_ID}`, method: 'GET', body: null },
      { path: '/v1/prices', method: 'POST', body: { listing_id: LISTING_ID } },
    ];

    const results = {};
    for (const ep of endpoints) {
      const r = await fetchPriceLabs(ep.path, ep.method, ep.body);
      results[`${ep.method} ${ep.path}`] = { status: r.status, preview: JSON.stringify(r.data).substring(0, 200) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
