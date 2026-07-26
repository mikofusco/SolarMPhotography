const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY){
  console.warn('[solarm] STRIPE_SECRET_KEY is not set — payment endpoints will fail until you add it to .env. See SETUP.md.');
}

module.exports = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing', {
  apiVersion: '2024-06-20'
});
