const https = require('https');

const PRICELABS_API_KEY = process.env.PRICELABS_API_KEY;
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
    const ids = ['1854001', '11854001', '1185400101', '11854001___1185400101'];
    const pmsOptions = ['booking', 'Booking.com'];
    const results = {};

    for (const id of ids) {
      for (const pms of pmsOptions) {
        const r = await fetchPriceLabs({ listings: [{ id, pms }] });
        results[`${id} / ${pms}`] = { status: r.status, preview: JSON.stringify(r.data).substring(0, 200) };
      }
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
