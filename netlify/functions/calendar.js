const https = require('https');
const http = require('http');

const ICAL_SOURCES = [
  'https://www.airbnb.fr/calendar/ical/894682312121769350.ics?t=16de6dbe7f9c404a9fde75efb0425646',
  'https://ical.booking.com/v1/export?t=40c551f3-957a-4644-9ee9-5fe24eb86144'
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; calendar-sync/1.0)' },
      timeout: 10000
    }, (res) => {
      // Suivre les redirections
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function parseIcal(icalData) {
  const unavailable = new Set();
  const lines = icalData.split(/\r?\n/);
  let inEvent = false;
  let dtstart = null, dtend = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { inEvent = true; dtstart = null; dtend = null; }
    if (line.startsWith('END:VEVENT')) {
      if (dtstart && dtend) {
        let current = new Date(dtstart);
        const end = new Date(dtend);
        while (current < end) {
          unavailable.add(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      }
      inEvent = false;
    }
    if (inEvent) {
      if (line.startsWith('DTSTART')) {
        const val = line.split(':').slice(1).join(':').trim().replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');
        dtstart = val.substring(0, 10);
      }
      if (line.startsWith('DTEND')) {
        const val = line.split(':').slice(1).join(':').trim().replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');
        dtend = val.substring(0, 10);
      }
    }
  }
  return unavailable;
}

exports.handler = async function(event, context) {
  const allUnavailable = new Set();
  const errors = [];

  for (const url of ICAL_SOURCES) {
    try {
      const result = await fetchUrl(url);
      console.log('Source:', url.substring(0, 50), '- Status:', result.status, '- Length:', result.data.length);
      if (result.status === 200 && result.data.includes('BEGIN:VCALENDAR')) {
        const dates = parseIcal(result.data);
        console.log('Dates trouvées:', dates.size);
        dates.forEach(d => allUnavailable.add(d));
      } else {
        errors.push(`Status ${result.status} for ${url.substring(0, 50)}`);
      }
    } catch(e) {
      console.log('Erreur:', url.substring(0, 50), e.message);
      errors.push(e.message);
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({ 
      unavailable: Array.from(allUnavailable).sort(),
      errors: errors,
      count: allUnavailable.size
    })
  };
};
