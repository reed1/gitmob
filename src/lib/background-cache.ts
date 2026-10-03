interface Slot<T> {
  value: T | undefined;
  /** When the last fetch finished, whether it answered or failed. */
  fetchedAt: number;
  /** Why the source has never answered, so the next caller is told without asking it. */
  error: unknown;
  inFlight: Promise<T> | null;
}

// Route handlers can each get their own copy of a module, so the slots live on globalThis:
// the Sudo tab's POST has to reach the same cache the project list reads.
const SLOTS = Symbol.for('gitmob.backgroundCache');
const globalSlots = globalThis as unknown as {
  [SLOTS]?: Map<string, Slot<unknown>>;
};
const slots = (globalSlots[SLOTS] ??= new Map());

export interface BackgroundCache<T> {
  /**
   * The last answer, straight away. One older than `maxAgeMs` is still what comes back, and
   * a new one is fetched behind it for the next caller. Only the very first call waits. A
   * source that has never answered is a failure held for as long as an answer would be.
   */
  get(): Promise<T>;
  /** Fetches a new answer now, and resolves once it is in. */
  refresh(): Promise<T>;
}

/**
 * A sweep that leaves this machine, kept in memory so the project list never waits on the
 * network. A failed fetch keeps the last answer rather than replacing it; with no answer yet,
 * the failure reaches the caller.
 */
export function backgroundCache<T>(
  key: string,
  maxAgeMs: number,
  load: () => Promise<T>
): BackgroundCache<T> {
  if (!slots.has(key)) {
    slots.set(key, {
      value: undefined,
      fetchedAt: 0,
      error: undefined,
      inFlight: null,
    });
  }
  const slot = slots.get(key) as Slot<T>;

  function refresh(): Promise<T> {
    slot.inFlight ??= load()
      .then(
        (value) => {
          slot.value = value;
          slot.error = undefined;
          slot.fetchedAt = Date.now();
          return value;
        },
        (error) => {
          if (slot.value === undefined) slot.error = error;
          slot.fetchedAt = Date.now();
          throw error;
        }
      )
      .finally(() => {
        slot.inFlight = null;
      });
    return slot.inFlight;
  }

  async function get(): Promise<T> {
    if (slot.fetchedAt === 0) return refresh();
    if (Date.now() - slot.fetchedAt >= maxAgeMs) {
      // The caller already has its answer; this one is for the next.
      refresh().catch(() => {});
    }
    if (slot.value === undefined) throw slot.error;
    return slot.value;
  }

  return { get, refresh };
}
