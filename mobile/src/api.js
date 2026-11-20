import { API_URL } from "./config";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status} en ${path}`);
  }
  return data;
}

export function registerDevice(expoPushToken, platform, mode = "remote") {
  return request("/devices", {
    method: "POST",
    body: JSON.stringify({ expoPushToken, platform, mode }),
  });
}

export function createAlert(payload) {
  return request("/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAlerts(expoPushToken) {
  return request(`/alerts?expoPushToken=${encodeURIComponent(expoPushToken)}`);
}

export function deleteAlert(id, expoPushToken) {
  return request(
    `/alerts/${id}?expoPushToken=${encodeURIComponent(expoPushToken)}`,
    { method: "DELETE" }
  );
}

export function checkNow(expoPushToken) {
  return request("/check-now", {
    method: "POST",
    body: JSON.stringify(expoPushToken ? { expoPushToken } : {}),
  });
}

export function health() {
  return request("/health");
}
