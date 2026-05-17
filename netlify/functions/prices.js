const https = require('https');

const MARKUP = 1.08;

function fetchJson(url, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'X-API-Key': apiKey }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const { listing_id, pms } = event.queryStringParameters || {};

  if (!listing_id || !pms) {
    return { statusCode: 400, body: JSON.stringify({ error: 'listing_id et pms requis' }) };
  }

  const apiKey = process.env.PRICELABS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Clé API PriceLabs manquante' }) };
  }

  try {
    const url = `https://api.pricelabs.co/v1/listing_prices?listing_id=${listing_id}&pms=${pms}`;
    const data = await fetchJson(url, apiKey);

    if (data.prices) {
      data.prices = data.prices.map(p => ({
        ...p,
        price: Math.round(p.price * MARKUP)
      }));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
      body: JSON.stringify(data)
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
