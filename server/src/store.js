// Bookings persist to a JSON file. This is deliberately simple — fine for a
// solo photographer's booking volume. If this ever needs to handle real
// concurrency or grows past a few thousand rows, swap this module for a
// real database (Postgres/SQLite) without touching the routes that call it.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

function ensureStore(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, '[]');
}
ensureStore();

// Chains writes through a single promise so two near-simultaneous bookings
// (e.g. the client's POST and a webhook recovery) can't race on the same
// read-modify-write and clobber each other.
let writeQueue = Promise.resolve();

function readBookings(){
  ensureStore();
  const raw = fs.readFileSync(BOOKINGS_FILE, 'utf8');
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function appendBooking(booking){
  writeQueue = writeQueue.then(function(){
    const bookings = readBookings();
    bookings.push(booking);
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    return booking;
  });
  return writeQueue;
}

function findBookingByPaymentIntent(paymentIntentId){
  return readBookings().find(function(b){ return b.paymentIntentId === paymentIntentId; });
}

module.exports = { readBookings, appendBooking, findBookingByPaymentIntent };
