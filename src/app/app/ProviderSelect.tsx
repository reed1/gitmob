'use client';

import type { ModelCatalog } from '../../lib/desktop-models';

export function ProviderSelect({
  catalog,
  value,
  onChange,
  disabled,
  className,
}: {
  catalog?: ModelCatalog;
  value?: string;
  onChange: (provider: string) => void;
  disabled: boolean;
  className: string;
}) {
  return (
    <select
      aria-label="Provider"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || !catalog}
      className={className}
    >
      {catalog ? (
        catalog.providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.label}
          </option>
        ))
      ) : (
        <option value="">Loading…</option>
      )}
    </select>
  );
}
