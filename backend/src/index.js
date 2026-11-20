import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import {
  upsertDevice,
  createAlert,
  listAlerts,
  deactivateAlert,
  listAllActiveAlerts,
  saveWebPushSubscription,
} from "./store.js";
import { startScheduler, runFlightCheck } from "./scheduler.js";
import { searchFlightsForAlert, filterMatchingDeals } from "./flightSearch.js";
import { getVapidPublicKey } from "./vapid.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.join(__dirname, "..", "..", "web", "dist");

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function isValidDeviceToken(token) {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken") ||
      token.startsWith("LocalDevice[") ||
      token.startsWith("WebDevice["))
  );
}

async function matchesForDevice(expoPushToken) {
  const alerts = listAlerts(String(expoPushToken));
  const matches = [];

  for (const alert of alerts) {
    const deals = await searchFlightsForAlert(alert);
    const underCap = filterMatchingDeals(deals, alert);
    for (const deal of underCap) {
      matches.push({ alert, deal });
    }
  }

  return matches;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: process.env.FLIGHT_PROVIDER || "demo",
    alerts: listAllActiveAlerts().length,
    currencyDefault: "USD",
    web: fs.existsSync(WEB_DIST),
  });
});

app.get("/web-push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post("/web-push/subscribe", (req, res) => {
  const { deviceId, subscription } = req.body || {};
  if (!deviceId || !subscription?.endpoint) {
    return res.status(400).json({ error: "deviceId y subscription requeridos" });
  }
  if (!String(deviceId).startsWith("WebDevice[")) {
    return res.status(400).json({ error: "deviceId debe ser WebDevice[...]" });
  }

  const device = saveWebPushSubscription(deviceId, subscription);
  res.json({ ok: true, deviceId: device.expoPushToken });
});

app.post("/devices", (req, res) => {
  const { expoPushToken, platform, mode } = req.body || {};
  if (!isValidDeviceToken(expoPushToken)) {
    return res.status(400).json({
      error:
        "Token inválido. Debe ser ExponentPushToken[...], LocalDevice[...] o WebDevice[...]",
    });
  }

  const device = upsertDevice(expoPushToken, {
    platform: platform || "unknown",
    mode:
      mode ||
      (expoPushToken.startsWith("WebDevice[")
        ? "web"
        : expoPushToken.startsWith("LocalDevice[")
          ? "local"
          : "remote"),
  });
  res.json({ device });
});

app.post("/alerts", (req, res) => {
  const {
    expoPushToken,
    origin,
    destination,
    departDate,
    returnDate,
    maxPrice,
    currency,
    mode,
  } = req.body || {};

  if (!expoPushToken || !origin || !destination || !departDate || maxPrice == null) {
    return res.status(400).json({
      error: "Faltan campos: expoPushToken, origin, destination, departDate, maxPrice",
    });
  }

  if (!isValidDeviceToken(expoPushToken)) {
    return res.status(400).json({ error: "Token de dispositivo inválido" });
  }

  const price = Number(maxPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: "maxPrice debe ser un número > 0" });
  }

  const resolvedMode =
    mode ||
    (expoPushToken.startsWith("WebDevice[")
      ? "web"
      : expoPushToken.startsWith("LocalDevice[")
        ? "local"
        : "remote");

  upsertDevice(expoPushToken, { mode: resolvedMode });

  const alert = createAlert({
    id: uuidv4(),
    expoPushToken,
    mode: resolvedMode,
    origin: String(origin).trim().toUpperCase(),
    destination: String(destination).trim().toUpperCase(),
    departDate,
    returnDate: returnDate || null,
    maxPrice: price,
    currency: (currency || "USD").toUpperCase(),
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.status(201).json({ alert });
});

app.get("/alerts", (req, res) => {
  const { expoPushToken } = req.query;
  if (!expoPushToken) {
    return res.status(400).json({ error: "expoPushToken query requerido" });
  }
  res.json({ alerts: listAlerts(String(expoPushToken)) });
});

app.delete("/alerts/:id", (req, res) => {
  const expoPushToken = req.body?.expoPushToken || req.query?.expoPushToken;
  if (!expoPushToken) {
    return res.status(400).json({ error: "expoPushToken requerido" });
  }
  const alert = deactivateAlert(req.params.id, String(expoPushToken));
  if (!alert) return res.status(404).json({ error: "Alerta no encontrada" });
  res.json({ alert });
});

app.post("/check-now", async (req, res) => {
  const { expoPushToken } = req.body || {};

  try {
    let matches = [];
    if (expoPushToken) {
      matches = await matchesForDevice(expoPushToken);
    }
    await runFlightCheck();
    res.json({ ok: true, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/check-for-device", async (req, res) => {
  const { expoPushToken } = req.body || {};
  if (!expoPushToken) {
    return res.status(400).json({ error: "expoPushToken requerido" });
  }

  try {
    const matches = await matchesForDevice(expoPushToken);
    runFlightCheck().catch(() => {});
    res.json({ ok: true, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webapp (misma URL que la API → sin problemas de cleartext/CORS)
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.includes(".")) return next();
    res.sendFile(path.join(WEB_DIST, "index.html"));
  });
  console.log(`[web] Sirviendo UI desde ${WEB_DIST}`);
} else {
  console.warn("[web] No hay build en web/dist. Corré: cd web && npm run build");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`VuelosWatch en http://0.0.0.0:${PORT}`);
  startScheduler();
});
