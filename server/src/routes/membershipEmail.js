const express = require('express');
const router = express.Router();
const { sendMembershipEmail } = require('../emails');

router.post('/send-membership-email', async (req, res) => {
  try {
    const { email, firstName, code } = req.body || {};
    if (!email || !firstName || !code) return res.status(400).json({ error: 'Missing fields.' });
    await sendMembershipEmail({ to: email, firstName, code });
    res.json({ ok: true });
  } catch (err) {
    console.error('send-membership-email failed:', err.message);
    res.status(500).json({ error: 'Could not send email.' });
  }
});

module.exports = router;
