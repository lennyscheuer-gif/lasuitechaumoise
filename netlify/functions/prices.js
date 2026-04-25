const https = require('https');

const PRICELABS_API_KEY = process.env.PRICELABS_API_KEY;
const LISTING_ID = '11854001___1185400101';
const MARKUP = 1.15;

function fetchPriceLabs() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      listing_id: LISTING_ID
    });

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
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
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
    console.log('PriceLabs status:', result.status);
    console.log('PriceLabs data:', JSON.stringify(result.data).substring(0, 500));

    if (result.status !== 200) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'PriceLabs error', details: result.data })
      };
    }

    const prices = {};
    const data = result.data;
    const priceList = data.prices || data || [];
    
    if (Array.isArray(priceList)) {
      priceList.forEach(item => {
        const date = item.date || item.d;
        const price = item.price || item.p;
        if (date && price) {
          prices[date] = Math.round(price * MARKUP);
        }
      });
    }

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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
