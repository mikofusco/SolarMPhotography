// Single source of truth for what actually gets charged. assets/book.js has
// its own copy of these prices for display before the server responds, but
// this file is authoritative — if you change a price, update both.
const SERVICES = {
  headshot: { name: 'Headshot Standard', priceCents: 17900 },
  korean: { name: 'Korean Style Portraits', priceCents: 32900 },
  editorial: { name: 'Editorial Shoots (deposit)', priceCents: 50000 },
  paparazzi: { name: 'Paparazzi Style', hourly: true, pricePerHourCents: 3000, minHours: 2, maxHours: 8 },
  buildown: {
    name: 'Build Your Own Package', customPhotos: true,
    basePriceCents: 17900, includedPhotos: 2,
    tier1PriceCents: 3750, tier1MaxPhotos: 5, // photos 3-5
    tier2PriceCents: 5000,                     // photo 6 onward
    minPhotos: 2, maxPhotos: 15
  }
};

const MEMBER_CODE = 'SOLARMEMBER15';
const MEMBER_DISCOUNT = 0.15;

function clampInt(value, min, max, fallback){
  let n = Math.round(Number(value));
  if (!Number.isFinite(n)) n = fallback;
  return Math.max(min, Math.min(max, n));
}

function photoPackageCents(service, photos){
  const extra = Math.max(0, photos - service.includedPhotos);
  const tier1Capacity = service.tier1MaxPhotos - service.includedPhotos;
  const tier1Count = Math.min(extra, tier1Capacity);
  const tier2Count = Math.max(0, extra - tier1Count);
  return service.basePriceCents + tier1Count * service.tier1PriceCents + tier2Count * service.tier2PriceCents;
}

function computeAmount(serviceId, promoCode, options){
  options = options || {};
  const service = SERVICES[serviceId];
  if (!service) return null;

  let baseCents;
  let clampedHours = null;
  let clampedPhotos = null;

  if (service.hourly){
    clampedHours = clampInt(options.hours, service.minHours, service.maxHours, service.minHours);
    baseCents = service.pricePerHourCents * clampedHours;
  } else if (service.customPhotos){
    clampedPhotos = clampInt(options.photos, service.minPhotos, service.maxPhotos, service.includedPhotos);
    baseCents = photoPackageCents(service, clampedPhotos);
  } else {
    baseCents = service.priceCents;
  }

  const promoApplied = !!promoCode && promoCode.trim().toUpperCase() === MEMBER_CODE;
  const amount = promoApplied ? Math.round(baseCents * (1 - MEMBER_DISCOUNT)) : baseCents;
  return { amount, promoApplied, service, hours: clampedHours, photos: clampedPhotos };
}

module.exports = { SERVICES, MEMBER_CODE, MEMBER_DISCOUNT, computeAmount };
