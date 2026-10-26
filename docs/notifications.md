# Notifications

A detached job with `notify` set pushes its result over Web Push (`src/lib/notifications.ts`) to
every device subscribed in `~/.local/share/gitmob/notification-devices.json`, received by
`public/sw.js`. A device subscribes from the Notifications page in the gear menu.

A question `claudex ask` parks while I am away is pushed the same way: the hook calls
`/api/claude-questions/notify` on the production port, and a tap opens the question's form.

A subscription dies with its origin's notification permission, which is why each PWA has a hostname
of its own — see [pwas.md](pwas.md).
