// Single source of truth for what actually gets charged. assets/book.js has
// its own copy of these prices for display before the server responds, but
// this file is authoritative — if you change a price, update both.
const SERVICES = {
  headshot: { name: 'Headshot Standard', priceCents: 17900 },
  korean: { name: 'Korean Style Portraits', priceCents: 32900 },
  editorial: { name: 'Editorial Shoots (deposit)', priceCents: 50000 }
};

const MEMBER_CODE = 'SOLARMEMBER15';
const MEMBER_DISCOUNT = 0.15;

function computeAmount(serviceId, promoCode){
  const service = SERVICES[serviceId];
  if (!service) return null;
  const promoApplied = !!promoCode && promoCode.trim().toUpperCase() === MEMBER_CODE;
  const amount = promoApplied
    ? Math.round(service.priceCents * (1 - MEMBER_DISCOUNT))
    : service.priceCents;
  return { amount, promoApplied, service };
}

module.exports = { SERVICES, MEMBER_CODE, MEMBER_DISCOUNT, computeAmount };
