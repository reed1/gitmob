type Listener = () => void;

export type ToastVariant = 'error' | 'warning' | 'success';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  leaving: boolean;
}

/** How long a dismissed toast stays mounted to play its exit animation. */
export const TOAST_EXIT_MS = 180;

let activeRequests = 0;
let toasts: Toast[] = [];
let nextToastId = 0;
const inFlightMutations = new Set<string>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return { activeRequests, toasts };
}

export function dismissToast(id: number) {
  const toast = toasts.find((t) => t.id === id);
  if (toast === undefined || toast.leaving) return;

  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, TOAST_EXIT_MS);
}

export function addToast(
  message: string,
  variant: ToastVariant = 'error',
  durationMs = 5000
) {
  const id = nextToastId++;
  toasts = [...toasts, { id, message, variant, durationMs, leaving: false }];
  notify();
  setTimeout(() => dismissToast(id), durationMs);
}

function mutationKey(url: string, method: string) {
  return `${method}:${url}`;
}

export class DuplicateRequestError extends Error {
  constructor() {
    super('Request already in progress');
  }
}

export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const method = (options?.method || 'GET').toUpperCase();
  const key = method === 'GET' ? null : mutationKey(url, method);

  if (key !== null) {
    if (inFlightMutations.has(key)) {
      addToast('Request already in progress');
      throw new DuplicateRequestError();
    }
    inFlightMutations.add(key);
  }
  activeRequests++;
  notify();

  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const cloned = res.clone();
      try {
        const data = await cloned.json();
        if (data.warning) {
          addToast(data.warning, 'warning');
        } else {
          addToast(data.error || `Request failed (${res.status})`);
        }
      } catch {
        addToast(`Request failed (${res.status})`);
      }
    }
    return res;
  } catch (err) {
    addToast(err instanceof Error ? err.message : 'Network error');
    throw err;
  } finally {
    if (key !== null) inFlightMutations.delete(key);
    activeRequests--;
    notify();
  }
}
