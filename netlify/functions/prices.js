const https = require('https');

const PRICELABS_API_KEY = process.env.PRICELABS_API_KEY;
const LISTING_ID = '894682312121769350';
const PMS = 'airbnb';
const MARKUP = 1.15;

function fetchPriceLabs() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ listings: [{ id: LISTING_ID, pms: PMS }] });
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
    const result = await fetchPriceLabs();

    if (result.status !== 200 || !Array.isArray(result.data) || result.data[0].error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'PriceLabs error', details: result.data })
      };
    }

    const listing = result.data[0];
    const prices = {};

    (listing.data || []).forEach(item => {
      if (item.date && item.price && item.price > 0) {
        prices[item.date] = Math.round(item.price * MARKUP);
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify({ prices, count: Object.keys(prices).length })
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
