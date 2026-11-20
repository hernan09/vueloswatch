/**
 * Proveedores de búsqueda de vuelos.
 *
 * IMPORTANTE: scrapear Despegar / aerolíneas desde un celular o un bot
 * casero suele fallar (CAPTCHA, bloqueos, ToS). Para un producto usable
 * usamos:
 *  - demo: genera ofertas realistas para probar notificaciones ya
 *  - amadeus: API oficial (gratis con registro)
 *
 * Si más adelante querés fuentes locales AR, lo limpio es integrar
 * APIs/afiliados (Amadeus, Kiwi Tequila, etc.), no HTML scraping frágil.
 */

function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function seededRandom(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i += 1) x = (x + seed.charCodeAt(i) * (i + 1)) % 9973;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

const AIRLINES = [
  { name: "Aerolíneas Argentinas", badge: "AR", color: "#74ACDF" },
  { name: "LATAM", badge: "LA", color: "#1B0088" },
  { name: "Flybondi", badge: "FO", color: "#FFD200" },
  { name: "JetSMART", badge: "JA", color: "#E31837" },
  { name: "GOL", badge: "G3", color: "#FF6600" },
  { name: "Avianca", badge: "AV", color: "#E4002B" },
];

const PLATFORMS = [
  { name: "Despegar", badge: "DESP", color: "#5603AD" },
  { name: "Kayak", badge: "KAY", color: "#FF690F" },
  { name: "Google Flights", badge: "GFL", color: "#4285F4" },
  { name: "Sitio aerolínea", badge: "AIR", color: "#0F766E" },
];

/** Link profundo a la búsqueda del vuelo según plataforma. */
export function buildDealUrl(alert, platformBadge) {
  const origin = String(alert.origin || "").toUpperCase();
  const destination = String(alert.destination || "").toUpperCase();
  const depart = alert.departDate;
  const ret = alert.returnDate || "";

  if (platformBadge === "DESP") {
    if (ret) {
      return `https://www.despegar.com.ar/shop/flights/results/roundtrip/${origin}/${destination}/${depart}/${ret}/1/0/0`;
    }
    return `https://www.despegar.com.ar/shop/flights/results/oneway/${origin}/${destination}/${depart}/1/0/0`;
  }

  if (platformBadge === "KAY") {
    const kayakPath = ret
      ? `${origin}-${destination}/${depart}/${ret}`
      : `${origin}-${destination}/${depart}`;
    return `https://www.kayak.com.ar/flights/${kayakPath}?sort=bestflight_a`;
  }

  const q = ret
    ? `Flights from ${origin} to ${destination} on ${depart} through ${ret}`
    : `Flights from ${origin} to ${destination} on ${depart}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

function buildDemoDeals(alert) {
  const rand = seededRandom(
    `${alert.origin}-${alert.destination}-${alert.departDate}-${Math.floor(Date.now() / (5 * 60 * 1000))}`
  );
  const tripDays = daysBetween(alert.departDate, alert.returnDate || alert.departDate);
  const currency = (alert.currency || "USD").toUpperCase();
  // Precios demo en USD (ida y vuelta típica LATAM)
  const base = Math.round(alert.maxPrice * (0.55 + rand() * 0.7));
  const count = 2 + Math.floor(rand() * 3);
  const deals = [];

  for (let i = 0; i < count; i += 1) {
    const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)];
    const platform = PLATFORMS[Math.floor(rand() * PLATFORMS.length)];
    const variance = Math.round((rand() - 0.45) * alert.maxPrice * 0.35);
    const price = Math.max(180, base + variance - i * 45);
    const stops = rand() > 0.65 ? 1 : 0;

    deals.push({
      id: `${alert.id}-${platform.badge}-${airline.badge}-${price}`,
      origin: alert.origin.toUpperCase(),
      destination: alert.destination.toUpperCase(),
      departDate: alert.departDate,
      returnDate: alert.returnDate || null,
      price,
      currency,
      airline: airline.name,
      airlineBadge: airline.badge,
      airlineColor: airline.color,
      platform: platform.name,
      platformBadge: platform.badge,
      platformColor: platform.color,
      stops,
      durationHours: Math.round(2 + tripDays * 0.2 + rand() * 8),
      url: buildDealUrl(alert, platform.badge),
      source: "demo",
    });
  }

  return deals.sort((a, b) => a.price - b.price);
}

async function getAmadeusToken() {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltan AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Amadeus auth falló: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function searchAmadeus(alert) {
  const token = await getAmadeusToken();
  const params = new URLSearchParams({
    originLocationCode: alert.origin.toUpperCase(),
    destinationLocationCode: alert.destination.toUpperCase(),
    departureDate: alert.departDate,
    adults: "1",
    max: "10",
    currencyCode: alert.currency || "USD",
  });
  if (alert.returnDate) params.set("returnDate", alert.returnDate);

  const res = await fetch(
    `https://test.api.amadeus.com/v2/shopping/flight-offers?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus search falló: ${res.status} ${text}`);
  }

  const data = await res.json();
  const offers = data.data || [];

  return offers.map((offer, index) => {
    const itinerary = offer.itineraries?.[0];
    const segment = itinerary?.segments?.[0];
    const carrier = segment?.carrierCode || "XX";
    const price = Number(offer.price?.total || 0);

    return {
      id: `${alert.id}-AMA-${offer.id || index}-${price}`,
      origin: alert.origin.toUpperCase(),
      destination: alert.destination.toUpperCase(),
      departDate: alert.departDate,
      returnDate: alert.returnDate || null,
      price,
      currency: offer.price?.currency || alert.currency || "USD",
      airline: carrier,
      airlineBadge: carrier,
      airlineColor: "#334155",
      platform: "Amadeus",
      platformBadge: "AMA",
      platformColor: "#0EA5E9",
      stops: Math.max(0, (itinerary?.segments?.length || 1) - 1),
      durationHours: null,
      url: null,
      source: "amadeus",
    };
  });
}

export async function searchFlightsForAlert(alert) {
  const provider = (process.env.FLIGHT_PROVIDER || "demo").toLowerCase();

  if (provider === "amadeus") {
    try {
      return await searchAmadeus(alert);
    } catch (err) {
      console.warn("[flightSearch] Amadeus falló, uso demo:", err.message);
      return buildDemoDeals(alert);
    }
  }

  return buildDemoDeals(alert);
}

export function filterMatchingDeals(deals, alert) {
  return deals.filter((deal) => Number(deal.price) <= Number(alert.maxPrice));
}
