const express = require('express');
const router = express.Router();
const stripe = require('../stripe');
const { computeAmount } = require('../services');

function truncate(str, max){
  if (!str) return '';
  return String(str).slice(0, max);
}

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { serviceId, promoCode, customerEmail, date, hour, customer } = req.body || {};
    const computed = computeAmount(serviceId, promoCode);
    if (!computed) return res.status(400).json({ error: 'Unknown service.' });

    const c = customer || {};

    // Metadata is the recovery path: if the customer's browser closes right
    // after a successful charge (before the frontend can call POST
    // /api/bookings), the Stripe webhook in routes/webhook.js reconstructs
    // the booking from this metadata instead of losing it entirely.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: computed.amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: customerEmail || undefined,
      metadata: {
        serviceId: serviceId || '',
        serviceName: computed.service.name,
        promoApplied: String(computed.promoApplied),
        date: date || '',
        hour: hour != null ? String(hour) : '',
        customerFirstName: truncate(c.firstName, 200),
        customerLastName: truncate(c.lastName, 200),
        customerEmail: truncate(c.email || customerEmail, 200),
        customerPhone: truncate(c.phone, 100),
        customerContactMethod: truncate(c.contactMethod, 50),
        customerGender: truncate(c.gender, 100),
        customerNotes: truncate(c.notes, 450)
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: computed.amount
    });
  } catch (err) {
    console.error('create-payment-intent failed:', err);
    res.status(500).json({ error: 'Could not start payment.' });
  }
});

module.exports = router;
