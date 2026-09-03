self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "FPL squad alert", body: "Your squad has a new update." };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: payload.url || "/" },
    tag: payload.tag || "fpl-squad-alert",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
