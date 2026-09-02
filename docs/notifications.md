# Notifications

A job with `notify` set pushes its result to every browser subscribed under
`~/.local/share/gitmob/notification-devices.json` — Web Push from `src/lib/notifications.ts`,
received by the service worker in `public/sw.js`, so the notification comes from the installed PWA
itself. The VAPID keypair generates itself on first send; the Notifications page in the gear menu is
where a device subscribes.

A push service answering 404/410 means that subscription is dead, so the send drops it — which is
why enabling always mints a fresh subscription rather than reusing the one the browser offers, and
why `sw.js` re-registers on `pushsubscriptionchange`. Delivery counts come back from
`sendNotification`: a send that reached nobody must not report success.

A push subscription dies with its origin's notification permission, which on Android is delegated to
the installed app's own app-level permission — the reason the two PWAs are on two hostnames, see
[pwas.md](pwas.md). Eviction of the origin's storage takes it too, so enabling asks for persistent
storage on the way through.
