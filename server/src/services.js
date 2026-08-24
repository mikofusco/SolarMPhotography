// Single source of truth for what actually gets charged. assets/book.js has
// its own copy of these prices for display before the server responds, but
// this file is authoritative — if you change a price, update both.
const SERVICES = {
  headshot: { name: 'Headshot Standard', priceCents: 17900 },
  korean: { name: 'Korean Style Portraits', priceCents: 32900 },
  editorial: { name: 'Editorial Shoots (deposit)', priceCents: 50000 },
  paparazzi: { name: 'Paparazzi Style', hourly: true, pricePerHourCents: 3000, minHours: 2, maxHours: 8 }
};

const MEMBER_CODE = 'SOLARMEMBER15';
const MEMBER_DISCOUNT = 0.15;

function computeAmount(serviceId, promoCode, hours){
  const service = SERVICES[serviceId];
  if (!service) return null;

  let baseCents;
  let clampedHours = null;
  if (service.hourly){
    clampedHours = Math.round(Number(hours));
    if (!Number.isFinite(clampedHours)) clampedHours = service.minHours;
    clampedHours = Math.max(service.minHours, Math.min(service.maxHours, clampedHours));
    baseCents = service.pricePerHourCents * clampedHours;
  } else {
    baseCents = service.priceCents;
  }

  const promoApplied = !!promoCode && promoCode.trim().toUpperCase() === MEMBER_CODE;
  const amount = promoApplied ? Math.round(baseCents * (1 - MEMBER_DISCOUNT)) : baseCents;
  return { amount, promoApplied, service, hours: clampedHours };
}

module.exports = { SERVICES, MEMBER_CODE, MEMBER_DISCOUNT, computeAmount };
