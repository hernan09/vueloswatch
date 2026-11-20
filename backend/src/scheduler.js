import cron from "node-cron";
import {
  listAllActiveAlerts,
  markDealSeen,
  wasDealSeen,
  getDevice,
} from "./store.js";
import { searchFlightsForAlert, filterMatchingDeals } from "./flightSearch.js";
import { buildDealNotification, sendExpoPush } from "./notifications.js";
import { sendWebPush } from "./vapid.js";

let running = false;

function money(amount, currency = "USD") {
  const n = Number(amount);
  if (currency === "USD") return `US$ ${n.toLocaleString("en-US")}`;
  return `$${n.toLocaleString("es-AR")} ${currency}`;
}

async function notifyWeb(alert, deal) {
  const device = getDevice(alert.expoPushToken);
  const sub = device?.webPushSubscription;
  if (!sub) return false;

  await sendWebPush(sub, {
    title: `${deal.platformBadge} · ${deal.origin}→${deal.destination} · ${money(deal.price, deal.currency)}`,
    body: `${deal.airline} en ${deal.platform} · Tocá para abrir el vuelo`,
    data: {
      url: deal.url,
      dealId: deal.id,
      badgeLabel: `${deal.platformBadge}:${deal.airlineBadge}`,
    },
  });
  return true;
}

export async function runFlightCheck() {
  if (running) {
    console.log("[scheduler] Chequeo anterior aún en curso, salteo");
    return;
  }

  running = true;
  const started = Date.now();

  try {
    const alerts = listAllActiveAlerts();
    console.log(`[scheduler] Revisando ${alerts.length} alerta(s)...`);

    const expoMessages = [];
    let webSent = 0;

    for (const alert of alerts) {
      try {
        const token = String(alert.expoPushToken || "");

        // Expo Go local: no push remota
        if (alert.mode === "local" || token.startsWith("LocalDevice[")) {
          continue;
        }

        const deals = await searchFlightsForAlert(alert);
        const matches = filterMatchingDeals(deals, alert);

        for (const deal of matches) {
          const key = `${alert.expoPushToken}:${deal.id}`;
          if (wasDealSeen(key)) continue;

          markDealSeen(key);
          console.log(
            `[scheduler] Match → ${deal.platform} ${deal.origin}-${deal.destination} $${deal.price}`
          );

          if (alert.mode === "web" || token.startsWith("WebDevice[")) {
            try {
              const ok = await notifyWeb(alert, deal);
              if (ok) webSent += 1;
            } catch (err) {
              console.warn("[scheduler] Web push falló:", err.message);
            }
            continue;
          }

          if (token.startsWith("ExponentPushToken")) {
            expoMessages.push(buildDealNotification(alert, deal));
          }
        }
      } catch (err) {
        console.error(`[scheduler] Error en alerta ${alert.id}:`, err.message);
      }
    }

    if (expoMessages.length) {
      const result = await sendExpoPush(expoMessages);
      console.log(
        `[scheduler] Expo push ${expoMessages.length}:`,
        JSON.stringify(result)
      );
    }

    if (!expoMessages.length && !webSent) {
      console.log("[scheduler] Sin ofertas nuevas bajo el tope");
    } else if (webSent) {
      console.log(`[scheduler] Web push enviadas: ${webSent}`);
    }
  } finally {
    running = false;
    console.log(`[scheduler] Listo en ${Date.now() - started}ms`);
  }
}

export function startScheduler() {
  const minutes = Math.max(1, Number(process.env.CHECK_INTERVAL_MINUTES || 5));
  const expression = `*/${minutes} * * * *`;

  cron.schedule(expression, () => {
    runFlightCheck().catch((err) => console.error("[scheduler]", err));
  });

  console.log(`[scheduler] Cron cada ${minutes} min (${expression})`);

  setTimeout(() => {
    runFlightCheck().catch((err) => console.error("[scheduler]", err));
  }, 15_000);
}
