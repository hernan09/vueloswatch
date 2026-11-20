/* Service worker: Web Push + abrir link del vuelo al tocar */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "VuelosWatch", body: event.data?.text() || "Nueva oferta" };
  }

  const title = payload.title || "VuelosWatch";
  const options = {
    body: payload.body || "Hay una oferta bajo tu tope",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: payload.data || {},
    tag: payload.data?.dealId || "flight-deal",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  event.waitUntil(
    (async () => {
      if (url) {
        const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clientsList) {
          if ("focus" in client) {
            await client.focus();
            if (client.navigate) await client.navigate(url);
            return;
          }
        }
        await clients.openWindow(url);
        return;
      }
      await clients.openWindow("/");
    })()
  );
});
