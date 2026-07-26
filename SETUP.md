# SolarM Photography — Setup Guide

This covers the two things that needed a real backend: **taking real payments with
Stripe** and **sending real email** (the membership discount code + new-booking
notifications). It also covers **how you (Miko) actually see the information
customers submit**, since before this backend existed, bookings only ever lived
in the customer's own browser and you had no way to see them at all.

## How the site is put together now

```
index.html          Homepage (hero, about, services, membership banner)
book.html           "Book an Appointment" — the 5-step booking wizard + Stripe payment
my-bookings.html    Signed-in customer's own bookings
profile.html        Signed-in customer's editable profile (name, photo, phone, password)
admin.html          Password-gated page where YOU view every booking submitted
assets/             Shared CSS/JS for all the pages above
server/             The Node/Express backend — the only part that touches
                     secrets (Stripe secret key, Resend API key)
```

Accounts and the customer-facing "My Bookings" list still live in the browser's
`localStorage`, same as before — that part is still a demo-quality prototype (see
**Known limitations** at the bottom). What changed is that the booking record
itself, and the Stripe charge, now also go through the real backend in `/server`,
because those two things cannot be done safely from browser JavaScript alone —
a Stripe **secret** key or an email API key in frontend code is visible to
anyone who opens dev tools, which is why they have to live server-side.

---

## 1. How you access what customers submit

Every time someone completes a booking and pays, three things happen automatically:

1. The booking is saved to `server/data/bookings.json` on your backend.
2. You get an email at whatever address you set as `PHOTOGRAPHER_NOTIFICATION_EMAIL`,
   with the customer's name, contact info, service, date/time, and their "anything
   I should know" notes.
3. You can view **every** booking, anytime, at `admin.html` on your deployed site
   (e.g. `https://yoursite.com/admin.html`) by entering the `ADMIN_KEY` you set in
   the backend's `.env` file. It shows a sortable table of every booking.

If you ever want to export everything at once, `server/data/bookings.json` is a
plain JSON file — open it directly, or back it up like any other file.

**A safety net:** if a customer's payment succeeds but their browser tab closes
before the booking is saved (bad wifi, closed laptop, etc.), a Stripe webhook
(`server/src/routes/webhook.js`) automatically reconstructs and saves the booking
anyway, so you never silently lose a paid booking. Setting up that webhook is
covered in step 2.5 below.

---

## 2. Stripe setup (real payments)

### 2.1 Create a Stripe account and get your test keys

1. Sign up at [stripe.com](https://stripe.com) if you haven't already.
2. In the Dashboard, make sure you're in **Test mode** (toggle top-right) while
   you set everything up — test mode uses fake money and fake cards, so you can't
   accidentally charge anyone.
3. Go to **Developers → API keys**. You'll see two keys:
   - **Publishable key** (`pk_test_...`) — safe to put in frontend code.
   - **Secret key** (`sk_test_...`) — never put this in frontend code, ever.

### 2.2 Configure the backend

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and fill in:

```
STRIPE_SECRET_KEY=sk_test_...          # from step 2.1
```

Leave `STRIPE_WEBHOOK_SECRET` for now — that comes from step 2.5.

### 2.3 Point the frontend at your publishable key and backend

Open `assets/app.js` and edit the top:

```js
window.SOLARM_CONFIG = {
  API_BASE: 'http://localhost:4242',                 // your backend's URL
  STRIPE_PUBLISHABLE_KEY: 'pk_test_...'               // from step 2.1
};
```

When you deploy, change `API_BASE` to your backend's real URL (see **Deployment**
below) and swap the publishable key for your **live** one when you're ready to
go live (step 2.6).

### 2.4 Run everything locally to test

```bash
# Terminal 1 — backend
cd server
npm start
# "SolarM Photography backend listening on http://localhost:4242"

# Terminal 2 — frontend (any static file server works)
cd ..
python3 -m http.server 8080
# open http://localhost:8080
```

Go through `book.html` end to end. On the payment step, use one of
[Stripe's test cards](https://docs.stripe.com/testing#cards) — the most common one:

- Card number: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits
- ZIP: any 5 digits

If it works, you'll land on the confirmation screen, and a new entry appears in
`server/data/bookings.json`.

### 2.5 Set up the webhook (recommended before going live)

This is the safety net described in section 1. Locally, use the Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:4242/api/stripe-webhook
```

It prints a `whsec_...` value — put that in `server/.env` as `STRIPE_WEBHOOK_SECRET`
and restart the backend.

In production, instead: Dashboard → **Developers → Webhooks → Add endpoint**,
point it at `https://your-backend-domain.com/api/stripe-webhook`, and select the
`payment_intent.succeeded` event. Copy the signing secret it gives you into your
production `.env` as `STRIPE_WEBHOOK_SECRET`.

### 2.6 Going live

1. Toggle Stripe out of Test mode and grab your **live** keys (same two places
   as step 2.1, `pk_live_...` / `sk_live_...`).
2. Update `STRIPE_SECRET_KEY` in your production `.env` and the publishable key
   in `assets/app.js` (or better — see the note in **Deployment** about not
   hardcoding this).
3. Repeat the webhook setup (step 2.5) for your live endpoint — test and live
   webhooks are separate.
4. Stripe requires your checkout page to be served over **HTTPS** in live mode;
   any of the static hosts below give you this for free.
5. Do one real, small, real-money test booking yourself before announcing you're
   live, and refund it from the Dashboard afterward.

---

## 3. Email setup (Resend) — membership code + booking notifications

1. Sign up at [resend.com](https://resend.com).
2. Go to **API Keys** and create one.
3. For real deliverability, verify your own sending domain under **Domains** —
   until you do, you can still send test emails from `onboarding@resend.dev`,
   but only to the email address on your own Resend account.
4. In `server/.env`:

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="SolarM Photography <onboarding@resend.dev>"   # or your verified domain
PHOTOGRAPHER_NOTIFICATION_EMAIL=you@yourdomain.com
```

That's it — sign-ups automatically email the 15%-off code, and every paid
booking emails you a notification, once the backend is running with these set.

---

## 4. The admin key

`ADMIN_KEY` in `server/.env` is the password `admin.html` asks for. Make it long
and random (a password manager's "generate password" feature is fine) — anyone
who has it can read every customer's name, email, and phone number. Don't reuse
a password you use elsewhere, and don't commit `.env` to git (it's already
gitignored).

---

## 5. Deployment

**Frontend** (`index.html`, `book.html`, etc. + `assets/`): any static host works —
Netlify, Vercel, GitHub Pages, Cloudflare Pages. Just deploy the repo root
(excluding `server/`).

**Backend** (`server/`): needs somewhere that runs Node processes —
Render, Railway, Fly.io, or a small VPS all work. Set the environment variables
from `server/.env.example` in that platform's dashboard (don't upload your `.env`
file itself). Point `FRONTEND_ORIGIN` at your deployed frontend's URL so CORS
allows it.

Once both are deployed, update `assets/app.js`'s `API_BASE` to your backend's
real URL and redeploy the frontend.

> For a real production setup, consider moving `STRIPE_PUBLISHABLE_KEY` and
> `API_BASE` out of a committed file and into a small build step or server-rendered
> config, so different environments (staging/production) don't require editing
> and re-committing source. Not necessary to launch, just worth knowing.

---

## Known limitations (still demo-quality, on purpose — ask if you want these built)

- **Accounts are still browser-only.** Sign up/sign in, "My Bookings", and
  profile edits all live in `localStorage` on each customer's own browser/device —
  there's no real server-side login yet. This is fine for the current scope but
  means, e.g., a customer switching from their phone to their laptop won't see
  their bookings there. Moving to real accounts (password hashing, sessions) is
  a bigger, separate project — let me know if you want it.
- **`server/data/bookings.json` is a flat file**, which is plenty for a solo
  photographer's booking volume. If this ever needs to handle serious concurrent
  traffic, swap it for a real database — the rest of the code doesn't need to
  change, only `server/src/store.js`.
- **Service prices are duplicated** in `assets/book.js` (for display) and
  `server/src/services.js` (the authoritative price actually charged). If you
  change a price, update both.
