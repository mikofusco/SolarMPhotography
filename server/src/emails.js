const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendMembershipEmail({ to, firstName, code }){
  if (!resend) throw new Error('RESEND_API_KEY is not set — see SETUP.md');
  // The Resend SDK resolves with { data, error } instead of throwing on API
  // errors (bad key, unverified domain, invalid recipient), so an unchecked
  // result here would silently report success. Throw explicitly instead.
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: 'Your SolarM Membership 15% off code',
    html: `
      <div style="font-family:sans-serif;background:#050609;color:#f7f7f9;padding:32px;">
        <h2 style="color:#e8c877;">Welcome to SolarM Membership, ${firstName}!</h2>
        <p>Thanks for signing up. Use the code below for 15% off your first session:</p>
        <p style="font-size:20px;letter-spacing:2px;background:#101838;border:1px dashed #cda34a;border-radius:8px;padding:12px 20px;display:inline-block;color:#e8c877;">${code}</p>
        <p>Enter it on the payment step when you book your session.</p>
        <p>— Miko, SolarM Photography</p>
      </div>
    `
  });
  if (result.error) throw new Error(result.error.message || 'Resend rejected the email.');
  return result.data;
}

async function sendBookingNotification({ booking }){
  if (!resend) throw new Error('RESEND_API_KEY is not set — see SETUP.md');
  const to = process.env.PHOTOGRAPHER_NOTIFICATION_EMAIL;
  if (!to) throw new Error('PHOTOGRAPHER_NOTIFICATION_EMAIL is not set — see SETUP.md');
  const c = booking.customer || {};
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: `New booking: ${booking.service} on ${booking.date}`,
    html: `
      <div style="font-family:sans-serif;">
        <h2>New booking — #${booking.id}</h2>
        <p><strong>Service:</strong> ${booking.service}</p>
        <p><strong>Date/time:</strong> ${booking.date} at ${booking.hour}:00</p>
        <p><strong>Total paid:</strong> $${Number(booking.total).toFixed(2)}</p>
        <hr>
        <p><strong>Customer:</strong> ${c.firstName || ''} ${c.lastName || ''}</p>
        <p><strong>Email:</strong> ${c.email || ''}</p>
        <p><strong>Phone:</strong> ${c.phone || ''}</p>
        <p><strong>Preferred contact:</strong> ${c.contactMethod || ''}</p>
        <p><strong>Gender:</strong> ${c.gender || ''}</p>
        <p><strong>Notes:</strong> ${c.notes || '(none)'}</p>
      </div>
    `
  });
  if (result.error) throw new Error(result.error.message || 'Resend rejected the email.');
  return result.data;
}

module.exports = { sendMembershipEmail, sendBookingNotification };
