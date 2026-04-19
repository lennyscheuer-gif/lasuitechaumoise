const https = require('https');

function stripeRequest(path, data) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const postData = new URLSearchParams(data).toString();
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com', port: 443, path: path, method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body);
    const { arrival, departure, guests, firstName, lastName, email, phone, total, amount } = body;
    const finalTotal = total || amount;
    if (!arrival || !departure || !email || (!total && !amount))
      return { statusCode: 400, body: JSON.stringify({ error: 'Paramètres manquants' }) };
    const description = `Séjour La Suite Chaumoise — ${arrival} au ${departure} — ${guests} personne(s) — ${firstName} ${lastName}`;
    const session = await stripeRequest('/v1/checkout/sessions', {
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][product_data][name]': 'Séjour La Suite Chaumoise',
      'line_items[0][price_data][product_data][description]': description,
      'line_items[0][price_data][unit_amount]': Math.round(finalTotal * 100),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'customer_email': email,
      'success_url': 'https://lasuitechaumoise.fr/?reservation=success',
      'cancel_url': 'https://lasuitechaumoise.fr/?reservation=cancel',
      'metadata[arrival]': arrival,
      'metadata[departure]': departure,
      'metadata[guests]': guests,
      'metadata[firstName]': firstName,
      'metadata[lastName]': lastName,
      'metadata[phone]': phone || '',
    });
    if (session.error) return { statusCode: 400, body: JSON.stringify({ error: session.error.message }) };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
