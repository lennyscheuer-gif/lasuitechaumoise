const https = require('https');
const SMOOBU_API_KEY = process.env.SMOOBU_API_KEY;
const SMOOBU_APARTMENT_ID = 3277112;

function smoobuGetReservations() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'login.smoobu.com', port: 443,
      path: `/api/reservations?apartments[]=${SMOOBU_APARTMENT_ID}&pageSize=100`,
      method: 'GET',
      headers: { 'Api-Key': SMOOBU_API_KEY, 'Cache-Control': 'no-cache' }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function generateIcal(reservations) {
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0',
    'PRODID:-//La Suite Chaumoise//FR',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH',
  ];
  for (const res of reservations) {
    if (!res['arrival-date'] || !res['departure-date']) continue;
    const dtstart = res['arrival-date'].replace(/-/g,'');
    const dtend = res['departure-date'].replace(/-/g,'');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${res.id}@lasuitechaumoise.fr`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:Réservé`);
    lines.push(`STATUS:CONFIRMED`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

exports.handler = async function(event, context) {
  try {
    const data = await smoobuGetReservations();
    const reservations = data.bookings || [];
    const ical = generateIcal(reservations);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="lasuitechaumoise.ics"',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: ical
    };
  } catch (error) {
    return { statusCode: 500, body: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR' };
  }
};
