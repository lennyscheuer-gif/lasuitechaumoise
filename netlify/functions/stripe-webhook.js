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

function sendEmail(to, subject, html) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      from: 'La Suite Chaumoise <contact@lasuitechaumoise.fr>',
      to: [to],
      subject: subject,
      html: html
    });
    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: body }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
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

    // 1. Créer la réservation dans Smoobu
    const reservationData = {
      'apartmentId': 3277722,
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
      'note': 'Réservation directe via lasuitechaumoise.fr'
    };

    const smoobuResult = await smoobuCreateReservation(reservationData);
    console.log('Smoobu:', smoobuResult.status, JSON.stringify(smoobuResult.data));

    // 2. Envoyer email de confirmation au client
    if (email) {
      const nights = Math.round((new Date(meta.departure) - new Date(meta.arrival)) / (1000*60*60*24));
      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="font-size: 28px; font-weight: 300; color: #2c4a5a; letter-spacing: 0.05em;">La Suite Chaumoise</h1>
    <p style="color: #8a7a6a; font-size: 0.9rem; letter-spacing: 0.15em; text-transform: uppercase;">Confirmation de réservation</p>
  </div>
  
  <div style="background: #f9f7f4; padding: 30px; margin-bottom: 30px;">
    <p style="color: #2c4a5a; font-size: 1.1rem; margin-bottom: 20px;">Bonjour ${meta.firstName},</p>
    <p style="color: #8a7a6a; line-height: 1.8;">Votre réservation à La Suite Chaumoise est confirmée. Nous avons hâte de vous accueillir !</p>
  </div>

  <div style="border-left: 3px solid #c8a96e; padding-left: 20px; margin-bottom: 30px;">
    <h2 style="font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; color: #c8a96e; margin-bottom: 15px;">Détails du séjour</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e8e0d5;">
        <td style="padding: 10px 0; color: #8a7a6a; font-size: 0.85rem;">Arrivée</td>
        <td style="padding: 10px 0; color: #2c4a5a; font-weight: 500;">${formatDate(meta.arrival)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e8e0d5;">
        <td style="padding: 10px 0; color: #8a7a6a; font-size: 0.85rem;">Départ</td>
        <td style="padding: 10px 0; color: #2c4a5a; font-weight: 500;">${formatDate(meta.departure)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e8e0d5;">
        <td style="padding: 10px 0; color: #8a7a6a; font-size: 0.85rem;">Durée</td>
        <td style="padding: 10px 0; color: #2c4a5a; font-weight: 500;">${nights} nuit${nights > 1 ? 's' : ''}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e8e0d5;">
        <td style="padding: 10px 0; color: #8a7a6a; font-size: 0.85rem;">Voyageurs</td>
        <td style="padding: 10px 0; color: #2c4a5a; font-weight: 500;">${meta.guests} personne${parseInt(meta.guests) > 1 ? 's' : ''}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #8a7a6a; font-size: 0.85rem;">Total payé</td>
        <td style="padding: 10px 0; color: #2c4a5a; font-weight: 500; font-size: 1.1rem;">${amount} €</td>
      </tr>
    </table>
  </div>

  <div style="background: #2c4a5a; padding: 25px; color: white; margin-bottom: 30px;">
    <h2 style="font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; color: #d4bb8a; margin-bottom: 15px;">Arrivée autonome</h2>
    <p style="color: rgba(255,255,255,0.8); line-height: 1.8; font-size: 0.9rem;">Votre arrivée est entièrement autonome. Le code de la boîte à clé vous sera communiqué par email la veille de votre arrivée.</p>
  </div>

  <div style="margin-bottom: 30px;">
    <h2 style="font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; color: #c8a96e; margin-bottom: 15px;">Adresse</h2>
    <p style="color: #8a7a6a; line-height: 1.8;">La Chaume, Les Sables-d'Olonne, Vendée</p>
  </div>

  <div style="border-top: 1px solid #e8e0d5; padding-top: 20px; text-align: center;">
    <p style="color: #8a7a6a; font-size: 0.8rem;">Une question ? Contactez-nous à <a href="mailto:contact@lasuitechaumoise.fr" style="color: #2c4a5a;">contact@lasuitechaumoise.fr</a></p>
    <p style="color: #c8c8c8; font-size: 0.75rem; margin-top: 10px;">La Suite Chaumoise · La Chaume, Les Sables-d'Olonne</p>
  </div>
</body>
</html>`;

      const emailResult = await sendEmail(email, `Confirmation de réservation — La Suite Chaumoise`, emailHtml);
      console.log('Email envoyé:', emailResult.status);

      // Email aussi au propriétaire
      await sendEmail('contact@lasuitechaumoise.fr', 
        `Nouvelle réservation — ${meta.firstName} ${meta.lastName} du ${formatDate(meta.arrival)} au ${formatDate(meta.departure)}`,
        `<p>Nouvelle réservation directe :</p><p><b>${meta.firstName} ${meta.lastName}</b><br>${email}<br>${meta.phone}<br>Du ${formatDate(meta.arrival)} au ${formatDate(meta.departure)}<br>${nights} nuit(s) · ${meta.guests} personne(s)<br><b>${amount} €</b></p>`
      );
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error('Webhook error:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
