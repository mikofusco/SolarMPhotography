// Separate JSON store for the general public custom-quote page — kept out
// of the regular bookings.json so its very different shape (line-item
// breakdown, free-text description, payMethod, no calendar blocking) never
// has to be reconciled with the normal booking records. Same
// read-modify-write queueing pattern as store.js.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const QUOTES_FILE = path.join(DATA_DIR, 'custom-quotes.json');

function ensureStore(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(QUOTES_FILE)) fs.writeFileSync(QUOTES_FILE, '[]');
}
ensureStore();

let writeQueue = Promise.resolve();

function readQuotes(){
  ensureStore();
  const raw = fs.readFileSync(QUOTES_FILE, 'utf8');
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function appendQuote(quote){
  writeQueue = writeQueue.then(function(){
    const quotes = readQuotes();
    quotes.push(quote);
    fs.writeFileSync(QUOTES_FILE, JSON.stringify(quotes, null, 2));
    return quote;
  });
  return writeQueue;
}

function findQuoteByPaymentIntent(paymentIntentId){
  return readQuotes().find(function(q){ return q.paymentIntentId === paymentIntentId; });
}

module.exports = { readQuotes, appendQuote, findQuoteByPaymentIntent };
