# Development and deployment

```
pnpm dev && pnpm lint && pnpm format
pnpm build && pnpm start
```

`pnpm dev` builds into `.next` and is yours to start, restart and kill. My own dev server is
`pnpm dev:rv`, started by `rv run` (cmd `web`) and served at http://dev.gitmob.loc — it builds into
`.next-dev`, so leave it running.

## Production

Deployed on my PC as the `gitmob` systemd user service, which runs `run_production.sh`: it builds
`.next-prod` (`GITMOB_DIST_DIR`) when HEAD moved, then serves it with `next start`.
