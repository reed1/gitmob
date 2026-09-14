# Development and deployment

```
pnpm dev && pnpm lint && pnpm format
pnpm build && pnpm start
```

`pnpm dev` builds into `.next` and is yours to start, restart and kill. My own dev server is
`pnpm dev:rv`, started by `rv run` (cmd `web`) and served at http://dev.gitmob.loc — it builds into
`.next-dev`, so leave it running.

## Production

Deployed as the `gitmob` systemd user service, which runs `run_production.sh`: it builds
`.next-prod` (`GITMOB_DIST_DIR`) when HEAD moved, then serves it with `next start`.

It runs on two machines, each showing its own projects and state: rdzero, my PC, at
`gitmob.zerotail.r-mulyadi.com`, and rdpav, my laptop, at `gitmob.pavtail.r-mulyadi.com`. Nothing
is shared between them: `/app/browser` drives the agent Chrome of the machine serving it, and each
has its own push subscriptions and VAPID keys, the two being separate origins and installs.
