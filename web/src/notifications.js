function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador no soporta service workers");
  }
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    throw new Error("Este navegador no soporta notificaciones");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permiso de notificaciones denegado");
  }
  return permission;
}

export async function subscribeToPush(reg, vapidPublicKey) {
  if (!("PushManager" in window)) {
    return null;
  }
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}

export function showLocalNotification({ title, body, url, badgeLabel }) {
  if (Notification.permission !== "granted") return false;
  const n = new Notification(title, {
    body,
    icon: "/icon.svg",
    tag: badgeLabel || "deal",
    data: { url },
  });
  n.onclick = () => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    n.close();
  };
  return true;
}
