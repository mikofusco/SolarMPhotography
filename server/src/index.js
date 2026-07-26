require('dotenv').config();
const express = require('express');
const cors = require('cors');

const webhookRouter = require('./routes/webhook');
const paymentIntentRouter = require('./routes/paymentIntent');
const bookingsRouter = require('./routes/bookings');
const membershipEmailRouter = require('./routes/membershipEmail');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));

// Mounted before express.json() — the Stripe webhook needs the raw request
// body to verify its signature (see routes/webhook.js).
app.use('/api', webhookRouter);

app.use(express.json());
app.use('/api', paymentIntentRouter);
app.use('/api', bookingsRouter);
app.use('/api', membershipEmailRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`SolarM Photography backend listening on http://localhost:${PORT}`);
});
