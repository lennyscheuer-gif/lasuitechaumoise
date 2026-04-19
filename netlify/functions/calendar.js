const https = require('https');

const ICAL_URL = 'https://login.smoobu.com/ical/detail/3277112.ics?s=82zX75JdRR';

function fetchIcal(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
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
        const val = line.split(':')[1].trim().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        dtstart = val.length === 10 ? val : val.substring(0, 10);
      }
      if (line.startsWith('DTEND')) {
        const val = line.split(':')[1].trim().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        dtend = val.length === 10 ? val : val.substring(0, 10);
      }
    }
  }
  return Array.from(unavailable).sort();
}

exports.handler = async function(event, context) {
  try {
    const icalData = await fetchIcal(ICAL_URL);
    const unavailable = parseIcal(icalData);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify({ unavailable })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, unavailable: [] })
    };
  }
};
