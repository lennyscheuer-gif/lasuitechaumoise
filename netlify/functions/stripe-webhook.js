const https = require('https');

function smoobuCreateReservation(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'login.smoobu.com',
      port: 443,
      path: '/api/reservations',
      method: 'POST',
      headers: {
        'Api-Key': process.env.SMOOBU_API_KEY,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripeEvent = JSON.parse(event.body);

    if (stripeEvent.type !== 'checkout.session.completed') {
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    const session = stripeEvent.data.object;
    const meta = session.metadata || {};
    const email = session.customer_email || session.customer_details?.email || '';
    const amount = (session.amount_total || 0) / 100;

    const reservationData = {
      'apartments': { 'id': 3277722 },
      'arrivalDate': meta.arrival,
      'departureDate': meta.departure,
      'firstName': meta.firstName || 'Invité',
      'lastName': meta.lastName || '',
      'email': email,
      'phone': meta.phone || '',
      'adults': parseInt(meta.guests) || 2,
      'children': 0,
      'price': amount,
      'deposit': 0,
      'currency': 'EUR',
      'note': 'Réservation directe via lasuitechaumoise.fr',
      'channelId': -1
    };

    console.log('Création réservation Smoobu:', JSON.stringify(reservationData));

    const result = await smoobuCreateReservation(reservationData);
    console.log('Réponse Smoobu:', result.status, JSON.stringify(result.data));

    if (result.status === 200 || result.status === 201) {
      return { statusCode: 200, body: JSON.stringify({ success: true, id: result.data.id }) };
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: 'Smoobu error', details: result.data }) };
    }

  } catch (error) {
    console.error('Webhook error:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
