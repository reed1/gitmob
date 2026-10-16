'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ModelCatalog } from './desktop-models';
import { useCachedState } from './use-cached-state';

const MODEL_CATALOG_KEY = 'gitmob:model-catalog';

// The front page and an open session box can both find the store empty on a first visit.
let inFlight: Promise<ModelCatalog> | undefined;

function fetchModelCatalog(): Promise<ModelCatalog> {
  inFlight ??= fetch('/api/desktop-models')
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data as ModelCatalog;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

/**
 * The providers a session can run, with their models and efforts. Fetched once per device and
 * kept in localStorage, so a session box opens without a round trip; `reload` fetches it anew
 * after claudex's catalog changes.
 */
export function useModelCatalog() {
  const [catalog, storeCatalog, restored] =
    useCachedState<ModelCatalog>(MODEL_CATALOG_KEY);
  const [error, setError] = useState('');
  const missing = restored && catalog === null;

  const reload = useCallback(
    async () => storeCatalog(await fetchModelCatalog()),
    [storeCatalog]
  );

  useEffect(() => {
    if (!missing) return;
    fetchModelCatalog().then(storeCatalog, (error) => setError(error.message));
  }, [missing, storeCatalog]);

  return { catalog: catalog ?? undefined, error, reload };
}
