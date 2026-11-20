/**
 * Envía push vía Expo Push API.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

function badgeForDeal(deal) {
  // Badge diferenciado por plataforma + aerolínea
  return `${deal.platformBadge}:${deal.airlineBadge}`;
}

function money(amount, currency = "USD") {
  const n = Number(amount);
  if (currency === "USD") return `US$ ${n.toLocaleString("en-US")}`;
  return `$${n.toLocaleString("es-AR")} ${currency}`;
}

function titleForDeal(deal) {
  return `${deal.platformBadge} · ${deal.origin}→${deal.destination} · ${money(deal.price, deal.currency)}`;
}

function bodyForDeal(deal, alert) {
  const stops = deal.stops === 0 ? "directo" : `${deal.stops} escala(s)`;
  return `${deal.airline} en ${deal.platform} · ${stops} · tope ${money(alert.maxPrice, alert.currency || "USD")} · Tocá para abrir el vuelo`;
}

export async function sendExpoPush(messages) {
  if (!messages.length) return { data: [] };

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Expo push error: ${JSON.stringify(json)}`);
  }
  return json;
}

export function buildDealNotification(alert, deal) {
  return {
    to: alert.expoPushToken,
    sound: "default",
    title: titleForDeal(deal),
    body: bodyForDeal(deal, alert),
    badge: 1,
    channelId: deal.platformBadge === "DESP" ? "despegar" : "flights",
    data: {
      alertId: alert.id,
      dealId: deal.id,
      platform: deal.platform,
      platformBadge: deal.platformBadge,
      airline: deal.airline,
      airlineBadge: deal.airlineBadge,
      price: deal.price,
      currency: deal.currency,
      origin: deal.origin,
      destination: deal.destination,
      url: deal.url || null,
      badgeLabel: badgeForDeal(deal),
      type: "flight_deal",
    },
  };
}
