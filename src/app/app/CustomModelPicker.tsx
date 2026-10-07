'use client';

import { useEffect, useState } from 'react';
import type { CustomModel, ModelCatalog } from '../../lib/desktop-models';

export function CustomModelPicker({
  value,
  onChange,
  disabled,
}: {
  value?: CustomModel;
  onChange: (value?: CustomModel) => void;
  disabled: boolean;
}) {
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
  const provider = catalog?.providers.find(
    (entry) => entry.id === value?.provider
  );
  const style =
    'min-w-0 text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2';
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled || !catalog?.providers.length}
          onChange={(event) => {
            const first = catalog?.providers[0];
            onChange(
              event.target.checked && first
                ? {
                    provider: first.id,
                    model: first.models[0].id,
                    effort: catalog!.efforts[0],
                  }
                : undefined
            );
          }}
        />
        Use custom model
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!catalog && !error && (
        <p className="text-xs text-foreground/50">Loading models…</p>
      )}
      {value && catalog && (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Provider"
            className={style}
            value={value.provider}
            disabled={disabled}
            onChange={(event) => {
              const next = catalog.providers.find(
                (entry) => entry.id === event.target.value
              )!;
              onChange({
                ...value,
                provider: next.id,
                model: next.models[0].id,
              });
            }}
          >
            {catalog.providers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Model"
            className={`${style} flex-1`}
            value={value.model}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, model: event.target.value })
            }
          >
            {provider?.models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Effort"
            className={style}
            value={value.effort}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, effort: event.target.value })
            }
          >
            {catalog.efforts.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
