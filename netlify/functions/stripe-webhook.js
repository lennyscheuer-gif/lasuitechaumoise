const https = require('https');

const SMOOBU_API_KEY = process.env.SMOOBU_API_KEY;
const SMOOBU_APARTMENT_ID = 3277112;

function smoobuRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'login.smoobu.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Api-Key': SMOOBU_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      }
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const stripeEvent = JSON.parse(event.body);
    if (stripeEvent.type !== 'checkout.session.completed') {
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }
    const session = stripeEvent.data.object;
    const metadata = session.metadata || {};
    const { arrival, departure, guests, firstName, lastName, phone } = metadata;
    const email = session.customer_email || '';
    const amount = session.amount_total / 100;
    if (!arrival || !departure) {
      return { statusCode: 400, body: 'Missing metadata' };
    }
    const reservationData = {
      'apartments': { 'id': SMOOBU_APARTMENT_ID },
      'arrivalDate': arrival,
      'departureDate': departure,
      'firstName': firstName || 'Invité',
      'lastName': lastName || '',
      'email': email,
      'phone': phone || '',
      'adults': parseInt(guests) || 2,
      'children': 0,
      'price': amount,
      'deposit': 0,
      'currency': 'EUR',
      'note': 'Réservation directe via lasuitechaumoise.fr — Paiement Stripe confirmé',
      'channelId': -1
    };
    const result = await smoobuRequest('POST', '/api/reservations', reservationData);
    if (result.status === 200 || result.status === 201) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: 'Smoobu error', details: result.data }) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
