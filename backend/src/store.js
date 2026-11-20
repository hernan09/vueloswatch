import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const defaultStore = () => ({
  devices: {},
  alerts: {},
  seenDeals: {},
});

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(defaultStore(), null, 2));
  }
}

export function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
}

export function writeStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function upsertDevice(expoPushToken, meta = {}) {
  const store = readStore();
  store.devices[expoPushToken] = {
    expoPushToken,
    updatedAt: new Date().toISOString(),
    ...meta,
  };
  writeStore(store);
  return store.devices[expoPushToken];
}

export function createAlert(alert) {
  const store = readStore();
  store.alerts[alert.id] = alert;
  writeStore(store);
  return alert;
}

export function listAlerts(expoPushToken) {
  const store = readStore();
  return Object.values(store.alerts).filter(
    (a) => a.expoPushToken === expoPushToken && a.active !== false
  );
}

export function listAllActiveAlerts() {
  const store = readStore();
  return Object.values(store.alerts).filter((a) => a.active !== false);
}

export function deactivateAlert(id, expoPushToken) {
  const store = readStore();
  const alert = store.alerts[id];
  if (!alert || alert.expoPushToken !== expoPushToken) return null;
  alert.active = false;
  alert.updatedAt = new Date().toISOString();
  writeStore(store);
  return alert;
}

export function markDealSeen(dealKey) {
  const store = readStore();
  store.seenDeals[dealKey] = new Date().toISOString();
  writeStore(store);
}

export function wasDealSeen(dealKey) {
  const store = readStore();
  return Boolean(store.seenDeals[dealKey]);
}

export function saveWebPushSubscription(deviceId, subscription) {
  const store = readStore();
  const current = store.devices[deviceId] || { expoPushToken: deviceId };
  store.devices[deviceId] = {
    ...current,
    expoPushToken: deviceId,
    mode: "web",
    platform: current.platform || "web",
    webPushSubscription: subscription,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.devices[deviceId];
}

export function getDevice(deviceId) {
  const store = readStore();
  return store.devices[deviceId] || null;
}
