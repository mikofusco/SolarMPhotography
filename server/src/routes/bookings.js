const express = require('express');
const router = express.Router();
const stripe = require('../stripe');
const store = require('../store');
const { sendBookingNotification } = require('../emails');
const { genConfirmationId } = require('../confirmationId');

// Called by the frontend right after stripe.confirmPayment() resolves.
router.post('/bookings', async (req, res) => {
  try {
    const { paymentIntentId, service, date, hour, customer } = req.body || {};
    if (!paymentIntentId) return res.status(400).json({ error: 'Missing paymentIntentId.' });

    // Never trust the client's word that payment succeeded — re-check with
    // Stripe directly before writing anything to disk or emailing Miko.
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded'){
      return res.status(402).json({ error: 'Payment has not succeeded yet.' });
    }

    // The webhook may have already recovered this same PaymentIntent
    // (see routes/webhook.js) if this request is arriving late/retried.
    const existing = store.findBookingByPaymentIntent(paymentIntentId);
    if (existing) return res.json({ id: existing.id, total: existing.total });

    const booking = {
      id: genConfirmationId(),
      paymentIntentId,
      service: (service && service.name) || paymentIntent.metadata.serviceName,
      date: date || paymentIntent.metadata.date,
      hour: hour != null ? hour : Number(paymentIntent.metadata.hour),
      total: paymentIntent.amount / 100,
      customer: customer || {},
      createdAt: new Date().toISOString()
    };
    await store.appendBooking(booking);

    sendBookingNotification({ booking }).catch(function(err){
      console.warn('Booking notification email failed:', err.message);
    });

    res.json({ id: booking.id, total: booking.total });
  } catch (err) {
    console.error('bookings POST failed:', err);
    res.status(500).json({ error: 'Could not save the booking.' });
  }
});

// Powers admin.html — the way Miko actually views submitted bookings.
router.get('/bookings', (req, res) => {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY){
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const bookings = store.readBookings().slice().sort(function(a, b){
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  res.json(bookings);
});

module.exports = router;
