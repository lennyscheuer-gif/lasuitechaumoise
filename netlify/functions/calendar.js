const https = require('https');
const http = require('http');

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

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseIcal(text) {
  const unavailable = new Set();
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let inEvent = false;
  let dtstart = null;
  let dtend = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; dtstart = null; dtend = null; }
    else if (line === 'END:VEVENT') {
      if (dtstart && dtend) {
        const start = new Date(dtstart);
        const end = new Date(dtend);
        const cur = new Date(start);
        while (cur < end) {
          unavailable.add(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        const val = line.split(':')[1]?.trim();
        if (val) dtstart = val.length === 8
          ? `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`
          : val;
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':')[1]?.trim();
        if (val) dtend = val.length === 8
          ? `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`
          : val;
      }
    }
  }
  return Array.from(unavailable).sort();
}

exports.handler = async (event) => {
  const property = event.queryStringParameters?.property || 'pigeonnier';
  const urls = ICAL_URLS[property];

  if (!urls) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Propriété inconnue' }) };
  }

  const unavailable = new Set();

  for (const [source, url] of Object.entries(urls)) {
    if (!url) continue;
    try {
      const text = await fetchUrl(url);
      const dates = parseIcal(text);
      dates.forEach(d => unavailable.add(d));
    } catch(e) {
      console.log(`Erreur iCal ${source}:`, e.message);
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=900',
    },
    body: JSON.stringify({ unavailable: Array.from(unavailable).sort(), property })
  };
};
