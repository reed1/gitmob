'use client';

import { useEffect, useState } from 'react';
import type { ModelCatalog } from './desktop-models';

/** The providers a session can run, with their models and efforts, as the server read them. */
export function useModelCatalog(): { catalog?: ModelCatalog; error: string } {
  const [catalog, setCatalog] = useState<ModelCatalog>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/desktop-models')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setCatalog(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return { catalog, error };
}
