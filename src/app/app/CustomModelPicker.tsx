'use client';

import type { CustomModel, ModelCatalog } from '../../lib/desktop-models';

/** A model and effort of the session's provider, out of `claudex models`. */
export function CustomModelPicker({
  catalog,
  error,
  provider,
  value,
  onChange,
  disabled,
}: {
  catalog?: ModelCatalog;
  error: string;
  provider?: string;
  value?: CustomModel;
  onChange: (value?: CustomModel) => void;
  disabled: boolean;
}) {
  const models = catalog?.providers.find(
    (entry) => entry.id === provider
  )?.models;
  const style =
    'min-w-0 text-sm bg-background border border-foreground/20 rounded-lg px-3 py-2';
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled || !models?.length}
          onChange={(event) =>
            onChange(
              event.target.checked && models?.length
                ? { model: models[0].id, effort: catalog!.efforts[0] }
                : undefined
            )
          }
        />
        Use custom model
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!catalog && !error && (
        <p className="text-xs text-foreground/50">Loading models…</p>
      )}
      {value && catalog && models && (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Model"
            className={`${style} flex-1`}
            value={value.model}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...value, model: event.target.value })
            }
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
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
