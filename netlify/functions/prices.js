const fetch = require('node-fetch');

// Supplément site direct vs plateformes
// PriceLabs = prix net. On ajoute +8% pour couvrir nos frais
// tout en restant sous les ~15% de commission Airbnb/Booking
const MARKUP = 1.08;

exports.handler = async (event) => {
  const { listing_id, pms } = event.queryStringParameters || {};
  
  if (!listing_id || !pms) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'listing_id et pms requis' })
    };
  }

  const apiKey = process.env.PRICELABS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Clé API PriceLabs manquante' })
    };
  }

  try {
    const url = `https://api.pricelabs.co/v1/listing_prices?listing_id=${listing_id}&pms=${pms}`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey }
    });

    if (!res.ok) {
      throw new Error(`PriceLabs API error: ${res.status}`);
    }

    const data = await res.json();
    
    // Appliquer le supplément +8% sur chaque prix
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
        'Cache-Control': 'public, max-age=3600', // cache 1h
      },
      body: JSON.stringify(data)
    };
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
