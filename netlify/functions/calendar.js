const https = require('https');

const ICAL_SOURCES = [
  'https://www.airbnb.fr/calendar/ical/894682312121769350.ics?t=16de6dbe7f9c404a9fde75efb0425646',
  'https://ical.booking.com/v1/export?t=40c551f3-957a-4644-9ee9-5fe24eb86144'
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? require('https') : require('http');
    protocol.get(url, (res) => {
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
  try {
    const allUnavailable = new Set();
    
    for (const url of ICAL_SOURCES) {
      try {
        const icalData = await fetchUrl(url);
        const dates = parseIcal(icalData);
        dates.forEach(d => allUnavailable.add(d));
      } catch(e) {
        console.log('Erreur source:', url, e.message);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify({ unavailable: Array.from(allUnavailable).sort() })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, unavailable: [] })
    };
  }
};
