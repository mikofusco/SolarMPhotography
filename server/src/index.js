require('dotenv').config();
const express = require('express');
const cors = require('cors');

const webhookRouter = require('./routes/webhook');
const paymentIntentRouter = require('./routes/paymentIntent');
const bookingsRouter = require('./routes/bookings');
const membershipEmailRouter = require('./routes/membershipEmail');

const app = express();

// FRONTEND_ORIGIN can be a single URL or a comma-separated list (handy for
// allowing both "example.com" and "www.example.com", which browsers treat
// as two different origins even though they're "the same site" to a person).
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '*')
  .split(',')
  .map(function(s){ return s.trim().replace(/\/$/, ''); })
  .filter(Boolean);

app.use(cors({
  origin: function(origin, callback){
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)){
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  }
}));

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
