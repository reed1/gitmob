'use client';

import { useState } from 'react';
import type { ModelCatalog } from '../../lib/desktop-models';

export interface SessionModel {
  provider: string;
  model: string;
  effort: string;
}

/**
 * The provider, model and effort a session opens on. Until one is picked it is the catalog's
 * first of each, which `claudex models` lists as its default.
 */
export function useSessionModel(catalog?: ModelCatalog) {
  const [chosen, setChosen] = useState<SessionModel>();
  const provider = catalog?.providers[0];
  const model = provider?.models[0];
  const effort = catalog?.efforts[0];
  const fallback =
    provider && model && effort
      ? { provider: provider.id, model: model.id, effort }
      : undefined;
  return [chosen ?? fallback, setChosen] as const;
}

export function SessionModelSelect({
  catalog,
  error,
  value,
  onChange,
  disabled,
}: {
  catalog?: ModelCatalog;
  error: string;
  value?: SessionModel;
  onChange: (value: SessionModel) => void;
  disabled: boolean;
}) {
  const style =
    'min-w-0 text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2';
  const choices =
    catalog?.providers.flatMap((provider) =>
      provider.models.map((model) => ({
        key: `${provider.id}/${model.id}`,
        label: `${provider.label} ${model.label}`,
        provider: provider.id,
        model: model.id,
      }))
    ) ?? [];

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          aria-label="Model"
          className={`${style} flex-1`}
          value={value ? `${value.provider}/${value.model}` : ''}
          disabled={disabled || !value}
          onChange={(event) => {
            const choice = choices.find(
              (entry) => entry.key === event.target.value
            )!;
            onChange({
              provider: choice.provider,
              model: choice.model,
              effort: value!.effort,
            });
          }}
        >
          {value ? (
            choices.map((choice) => (
              <option key={choice.key} value={choice.key}>
                {choice.label}
              </option>
            ))
          ) : (
            <option value="">Loading…</option>
          )}
        </select>
        <select
          aria-label="Effort"
          className={style}
          value={value?.effort ?? ''}
          disabled={disabled || !value}
          onChange={(event) =>
            onChange({ ...value!, effort: event.target.value })
          }
        >
          {catalog?.efforts.map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
