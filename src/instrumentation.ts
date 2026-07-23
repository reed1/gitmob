const REAP_INTERVAL_MS = 3 * 60 * 60 * 1000;
const REAP_STARTUP_DELAY_MS = 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { reapIdleSessions } = await import('@/lib/claude-sessions');

  const run = () => {
    try {
      const reaped = reapIdleSessions();
      if (reaped.length > 0) {
        const summary = reaped
          .map(
            (r) =>
              `${r.projectId}(pid ${r.pid}, idle ${Math.round(r.idleMs / 60000)}m)`
          )
          .join(', ');
        console.log(
          `[claude-reaper] terminated ${reaped.length} idle session(s): ${summary}`
        );
      }
    } catch (err) {
      console.error('[claude-reaper] failed:', err);
    }
  };

  setTimeout(run, REAP_STARTUP_DELAY_MS).unref();
  setInterval(run, REAP_INTERVAL_MS).unref();
}
