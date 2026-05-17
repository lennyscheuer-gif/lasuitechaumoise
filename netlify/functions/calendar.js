const fetch = require('node-fetch');
const ical = require('node-ical');

// iCal URLs — à renseigner directement depuis Airbnb et Booking
const ICAL_URLS = {
  pigeonnier: {
    airbnb: process.env.ICAL_PIGEONNIER_AIRBNB || '',
    booking: process.env.ICAL_PIGEONNIER_BOOKING || '',
  },
  'suite-du-quai': {
    airbnb: process.env.ICAL_SUITE_AIRBNB || '',
    booking: process.env.ICAL_SUITE_BOOKING || '',
  }
};

async function getUnavailableDates(urls) {
  const unavailable = new Set();
  
  for (const [source, url] of Object.entries(urls)) {
    if (!url) continue;
    try {
      const res = await fetch(url, { timeout: 8000 });
      const text = await res.text();
      const data = ical.parseICS(text);
      
      for (const event of Object.values(data)) {
        if (event.type !== 'VEVENT') continue;
        const start = new Date(event.start);
        const end = new Date(event.end);
        // Bloquer chaque jour de la réservation
        const cur = new Date(start);
        while (cur < end) {
          unavailable.add(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }
      }
    } catch(e) {
      console.log(`Erreur iCal ${source}:`, e.message);
    }
  }
  
  return Array.from(unavailable).sort();
}

exports.handler = async (event) => {
  const property = event.queryStringParameters?.property || 'pigeonnier';
  const urls = ICAL_URLS[property];
  
  if (!urls) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Propriété inconnue' })
    };
  }

  try {
    const unavailable = await getUnavailableDates(urls);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900', // cache 15 min
      },
      body: JSON.stringify({ unavailable, property })
    };
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
