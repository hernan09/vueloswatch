import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const webpush = require("web-push");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAPID_FILE = path.join(__dirname, "..", "data", "vapid.json");

function ensureVapid() {
  if (fs.existsSync(VAPID_FILE)) {
    return JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
  }

  const keys = webpush.generateVAPIDKeys();
  const payload = {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: "mailto:vueloswatch@localhost",
  };

  const dir = path.dirname(VAPID_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(VAPID_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

const vapid = ensureVapid();

webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

export function getVapidPublicKey() {
  return vapid.publicKey;
}

export async function sendWebPush(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}
