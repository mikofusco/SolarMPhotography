const express = require('express');
const router = express.Router();
const { addMarketingContact } = require('../emails');

router.post('/subscribe', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email.' });
    await addMarketingContact({ email, firstName, lastName });
    res.json({ ok: true });
  } catch (err) {
    console.error('subscribe failed:', err.message);
    res.status(500).json({ error: 'Could not add contact.' });
  }
});

module.exports = router;
