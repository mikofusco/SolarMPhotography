const express = require('express');
const router = express.Router();
const stripe = require('../stripe');
const store = require('../store');
const { sendBookingNotification } = require('../emails');
const { genConfirmationId } = require('../confirmationId');

// Stripe needs the raw (unparsed) body to verify the signature, so this
// route uses express.raw() instead of the app-wide express.json().
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded'){
    const paymentIntent = event.data.object;
    try {
      const existing = store.findBookingByPaymentIntent(paymentIntent.id);
      if (!existing){
        // Normally the frontend finalizes the booking via POST /api/bookings
        // right after confirmPayment() resolves. This is the safety net for
        // when a customer closes the tab (or the network drops) between a
        // successful charge and that call — the booking is reconstructed
        // here from the metadata stored when the PaymentIntent was created.
        const m = paymentIntent.metadata || {};
        const booking = {
          id: genConfirmationId(),
          paymentIntentId: paymentIntent.id,
          service: m.serviceName || m.serviceId || 'Unknown service',
          date: m.date || '',
          hour: m.hour ? Number(m.hour) : null,
          total: paymentIntent.amount / 100,
          customer: {
            firstName: m.customerFirstName || '',
            lastName: m.customerLastName || '',
            email: m.customerEmail || '',
            phone: m.customerPhone || '',
            contactMethod: m.customerContactMethod || '',
            gender: m.customerGender || '',
            notes: m.customerNotes || ''
          },
          createdAt: new Date().toISOString(),
          recoveredByWebhook: true
        };
        await store.appendBooking(booking);
        sendBookingNotification({ booking }).catch(function(err){
          console.warn('Booking notification email failed:', err.message);
        });
      }
    } catch (err) {
      console.error('Webhook booking recovery failed:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;
