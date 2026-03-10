type Listener = () => void;

interface Toast {
  id: number;
  message: string;
}

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
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function addToast(message: string) {
  const id = nextToastId++;
  toasts = [...toasts, { id, message }];
  notify();
  setTimeout(() => dismissToast(id), 5000);
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
  const isMutation = method !== 'GET';

  if (isMutation) {
    const key = mutationKey(url, method);
    if (inFlightMutations.has(key)) {
      addToast('Request already in progress');
      throw new DuplicateRequestError();
    }
    inFlightMutations.add(key);
    activeRequests++;
    notify();

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const cloned = res.clone();
        try {
          const data = await cloned.json();
          addToast(data.error || `Request failed (${res.status})`);
        } catch {
          addToast(`Request failed (${res.status})`);
        }
      }
      return res;
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Network error');
      throw err;
    } finally {
      inFlightMutations.delete(key);
      activeRequests--;
      notify();
    }
  }

  return fetch(url, options);
}
