const express = require('express');
const router = express.Router();
const stripe = require('../stripe');
// Shared with the frontend (haus-of-k-quote.html) — see that file's header
// comment. Recomputing the total here, instead of trusting the browser,
// is what makes the Stripe charge and the saved record authoritative.
const HausOfKPricing = require('../../../assets/hausOfKPricing');
const hausOfKStore = require('../hausOfKStore');
const { genConfirmationId } = require('../confirmationId');
const { sendHausOfKNotification } = require('../emails');

const VALID_PAY_METHODS = ['zelle', 'paypal', 'stripe', 'bank'];

function truncate(str, max){
  if (!str) return '';
  return String(str).slice(0, max);
}

function validatePayload(body){
  const errors = [];
  const sel = body.selections || {};
  const customer = body.customer || {};

  if (!HausOfKPricing.COVERAGE_OPTIONS.some(function(c){ return c.id === sel.coverageType; })){
    errors.push('Please choose a coverage type.');
  }
  if (!body.date) errors.push('Missing event date.');
  if (!body.time) errors.push('Missing event start time.');
  if (!customer.name || !customer.name.trim()) errors.push('Missing name.');
  if (!customer.email || !/^\S+@\S+\.\S+$/.test(customer.email.trim())) errors.push('Missing or invalid email.');
  if (!customer.phone || customer.phone.trim().length < 7) errors.push('Missing or invalid phone.');
  if (!body.termsAccepted) errors.push('Terms must be accepted.');
  if (!VALID_PAY_METHODS.includes(body.payMethod)) errors.push('Invalid payment method.');

  return errors;
}

router.post('/haus-of-k/create-payment-intent', async (req, res) => {
  try {
    const body = req.body || {};
    const errors = validatePayload(body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const result = HausOfKPricing.computeTotal(body.selections);
    if (!result.total || result.total <= 0){
      return res.status(400).json({ error: 'Nothing to charge — add at least one item to the package.' });
    }

    const amount = Math.round(result.total * 100);
    const customer = body.customer || {};

    // Metadata is the webhook-recovery path (see routes/webhook.js note in
    // bookings.js) if the browser never finishes the /submit call after a
    // successful charge.
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email || undefined,
      metadata: {
        quoteType: 'haus-of-k',
        coverageType: body.selections.coverageType || '',
        hours: String(body.selections.hours || ''),
        date: body.date || '',
        time: body.time || '',
        customerName: truncate(customer.name, 200),
        customerEmail: truncate(customer.email, 200),
        customerPhone: truncate(customer.phone, 100)
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount
    });
  } catch (err) {
    console.error('haus-of-k create-payment-intent failed:', err);
    res.status(500).json({ error: 'Could not start payment.' });
  }
});

router.post('/haus-of-k/submit', async (req, res) => {
  try {
    const body = req.body || {};
    const errors = validatePayload(body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const result = HausOfKPricing.computeTotal(body.selections);

    if (body.payMethod === 'stripe'){
      if (!body.paymentIntentId) return res.status(400).json({ error: 'Missing paymentIntentId.' });

      // Never trust the client's word that payment succeeded.
      const paymentIntent = await stripe.paymentIntents.retrieve(body.paymentIntentId);
      if (paymentIntent.status !== 'succeeded'){
        return res.status(402).json({ error: 'Payment has not succeeded yet.' });
      }
      const existing = hausOfKStore.findQuoteByPaymentIntent(body.paymentIntentId);
      if (existing) return res.json({ id: existing.id, total: existing.total });
    }

    const quote = {
      id: genConfirmationId(),
      selections: body.selections,
      lines: result.lines,
      buyoutInterest: result.buyoutInterest,
      total: result.total,
      date: body.date,
      time: body.time,
      customer: body.customer,
      payMethod: body.payMethod,
      // Zelle/PayPal/bank transfer can't be verified automatically — Miko
      // confirms those manually once the money actually arrives.
      paymentIntentId: body.payMethod === 'stripe' ? body.paymentIntentId : null,
      status: body.payMethod === 'stripe' ? 'paid' : 'pending_manual_payment',
      createdAt: new Date().toISOString()
    };
    await hausOfKStore.appendQuote(quote);

    sendHausOfKNotification({ quote }).catch(function(err){
      console.warn('HAUS OF K notification email failed:', err.message);
    });

    res.json({ id: quote.id, total: quote.total });
  } catch (err) {
    console.error('haus-of-k submit failed:', err);
    res.status(500).json({ error: 'Could not submit this quote.' });
  }
});

module.exports = router;
