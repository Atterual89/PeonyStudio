/* Web Push di Peony: nessuna cache, nessuna intercettazione delle richieste. */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignora payload non valido */ }
  const url = typeof data.url === "string" && data.url.startsWith("/gestione/") ? data.url : "/gestione";
  const title = typeof data.title === "string" ? data.title.slice(0, 100) : "Notifica Peony";
  const body = typeof data.body === "string" ? data.body.slice(0, 200) : "Hai una nuova notifica.";
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body, tag: typeof data.tag === "string" ? data.tag : "peony",
      data: { url }, icon: "/favicon.ico", badge: "/favicon.ico",
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) client.postMessage({ type: "peony-new-notification" });
    }),
  ]));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const route = event.notification.data?.url;
  const path = typeof route === "string" && route.startsWith("/gestione/") ? route : "/gestione";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = pages.find(page => new URL(page.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target);
      await existing.focus();
    } else {
      await self.clients.openWindow(target);
    }
  })());
});
