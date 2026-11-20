const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function url(path) {
  return `${API_BASE}${path}`;
}

async function request(path, options = {}) {
  const res = await fetch(url(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status} en ${path}`);
  return data;
}

export function health() {
  return request("/health");
}

export function registerDevice(deviceId, platform = "web", mode = "web") {
  return request("/devices", {
    method: "POST",
    body: JSON.stringify({ expoPushToken: deviceId, platform, mode }),
  });
}

export function createAlert(payload) {
  return request("/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAlerts(deviceId) {
  return request(`/alerts?expoPushToken=${encodeURIComponent(deviceId)}`);
}

export function deleteAlert(id, deviceId) {
  return request(`/alerts/${id}?expoPushToken=${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

export function checkNow(deviceId) {
  return request("/check-now", {
    method: "POST",
    body: JSON.stringify({ expoPushToken: deviceId }),
  });
}

export function getVapidPublicKey() {
  return request("/web-push/vapid-public-key");
}

export function subscribeWebPush(deviceId, subscription) {
  return request("/web-push/subscribe", {
    method: "POST",
    body: JSON.stringify({ deviceId, subscription }),
  });
}
