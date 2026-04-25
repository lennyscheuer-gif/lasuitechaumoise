const https = require('https');

const PRICELABS_API_KEY = process.env.PRICELABS_API_KEY;
const LISTING_ID = '11854001___1185400101';
const MARKUP = 1.15;

function fetchPriceLabs(body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'api.pricelabs.co',
      port: 443,
      path: '/v1/listing_prices',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PRICELABS_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async function(event, context) {
  try {
    // Tester différents formats de body
    const bodies = [
      { listings: [LISTING_ID] },
      { listings: [{ id: LISTING_ID }] },
      { listings: LISTING_ID },
    ];

    const results = {};
    for (const body of bodies) {
      const r = await fetchPriceLabs(body);
      results[JSON.stringify(body)] = { status: r.status, preview: JSON.stringify(r.data).substring(0, 300) };
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
