'use client';

import { useCallback, useRef, useState } from 'react';
import { addToast } from '@/lib/api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { useCachedState } from '@/lib/use-cached-state';
import { CHECKLIST_NAME, type Checklist } from '@/lib/checklist-name';

const ICONS = {
  up: 'M5 15l7-7 7 7',
  down: 'M19 9l-7 7-7-7',
  remove: 'M6 18L18 6M6 6l12 12',
  add: 'M12 4v16m8-8H4',
  refresh:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
};

const LISTS_KEY = 'checklist:lists';

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      className={className ?? 'w-4 h-4'}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  );
}

function IconButton({
  path,
  label,
  onClick,
  disabled,
  danger,
}: {
  path: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`shrink-0 p-2 rounded-lg hover:bg-foreground/10 active:opacity-80 disabled:opacity-20 ${
        danger ? 'text-red-400' : 'text-foreground/60'
      }`}
    >
      <Icon path={path} />
    </button>
  );
}

const INPUT =
  'min-w-0 flex-1 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-1.5 placeholder:text-foreground/40 focus:outline-none focus:border-blue-400/70';

function moved<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const next = [...list];
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}

/** Typed into the shape a name must have, so the box never holds one the server refuses. */
function asName(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z-]/g, '');
}

function problemWith(draft: Checklist[]): string | null {
  if (draft.some((list) => !CHECKLIST_NAME.test(list.name))) {
    return 'Names are letters joined by single dashes';
  }
  const names = draft.map((list) => list.name);
  if (new Set(names).size !== names.length) return 'Two lists share a name';
  return null;
}

function AddItemInput({ onAdd }: { onAdd: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const add = () => {
    const text = input.current!.value.trim();
    if (text === '') return;
    onAdd(text);
    input.current!.value = '';
    input.current!.focus();
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <input
        ref={input}
        type="text"
        placeholder="Add an item"
        enterKeyHint="enter"
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
        className={`${INPUT} text-sm`}
      />
      <IconButton path={ICONS.add} label="Add item" onClick={add} />
    </div>
  );
}

function ListEditor({
  list,
  autoFocus,
  onChange,
  onDelete,
}: {
  list: Checklist;
  autoFocus: boolean;
  onChange: (list: Checklist) => void;
  onDelete: () => void;
}) {
  const setItems = (items: string[]) => onChange({ ...list, items });

  return (
    <section className="rounded-lg border border-foreground/10 bg-foreground/[0.03]">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-foreground/10">
        <input
          type="text"
          value={list.name}
          placeholder="list-name"
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(e) => onChange({ ...list, name: asName(e.target.value) })}
          className={`${INPUT} font-mono font-medium`}
        />
        <IconButton
          path={ICONS.remove}
          label="Delete list"
          danger
          onClick={onDelete}
        />
      </div>
      <ul className="divide-y divide-foreground/5">
        {list.items.map((item, index) => (
          <li key={index} className="flex items-center gap-1 px-3 py-1.5">
            <input
              type="text"
              value={item}
              onChange={(e) =>
                setItems(
                  list.items.map((other, i) =>
                    i === index ? e.target.value : other
                  )
                )
              }
              className={`${INPUT} text-sm`}
            />
            <IconButton
              path={ICONS.up}
              label="Move item up"
              disabled={index === 0}
              onClick={() => setItems(moved(list.items, index, -1))}
            />
            <IconButton
              path={ICONS.down}
              label="Move item down"
              disabled={index === list.items.length - 1}
              onClick={() => setItems(moved(list.items, index, 1))}
            />
            <IconButton
              path={ICONS.remove}
              label="Remove item"
              danger
              onClick={() => setItems(list.items.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      <AddItemInput onAdd={(text) => setItems([...list.items, text])} />
    </section>
  );
}

/**
 * The cached lists paint on open and are replaced when the server answers. Edit waits for that
 * answer, since Save sends every list and would otherwise write back a stale one. Edits stay on
 * the page until Save, which sends every list to be written to `checklists/` and committed, then
 * reads them back. Cancel drops them.
 */
export default function ChecklistPage() {
  const [lists, setLists, restored] = useCachedState<Checklist[]>(LISTS_KEY);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [draft, setDraft] = useState<Checklist[] | null>(null);
  const [addedIndex, setAddedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch('/api/checklist');
    setLists((await res.json()).checklists);
    setLoaded(true);
    setRefreshing(false);
  }, [setLists]);

  useAutoRefresh(load);

  const problem = draft === null ? null : problemWith(draft);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/checklist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklists: draft!.map((list) => ({
          name: list.name,
          items: list.items.map((item) => item.trim()).filter(Boolean),
        })),
      }),
    }).catch(() => null);
    if (res?.ok) {
      await load();
      setDraft(null);
      addToast('Checklist saved', 'success');
    } else {
      const error = res && (await res.json()).error;
      addToast(error ?? 'Saving failed');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-background border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Checklist</h1>
            {problem !== null && (
              <div className="text-xs text-amber-400 truncate">{problem}</div>
            )}
          </div>
          {draft === null ? (
            <>
              <button
                onClick={load}
                className="p-2 rounded-lg hover:bg-foreground/10 active:opacity-80"
                aria-label="Refresh"
              >
                <Icon
                  path={ICONS.refresh}
                  className={`w-5 h-5 text-foreground/60 ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => {
                  setDraft(lists);
                  setAddedIndex(null);
                }}
                disabled={!loaded}
                className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 active:opacity-80"
              >
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setDraft(null)}
                disabled={saving}
                className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/10 disabled:opacity-30"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || problem !== null}
                className="px-3 py-1.5 text-sm rounded-lg bg-blue-500 text-white disabled:opacity-30 active:opacity-80"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="p-3 space-y-3">
        {restored && lists === null && (
          <div className="text-center text-foreground/50 py-8">Loading...</div>
        )}

        {draft === null && lists?.length === 0 && (
          <div className="text-center text-foreground/50 py-8">
            No lists yet — tap Edit to add one
          </div>
        )}

        {draft === null
          ? lists?.map((list) => (
              <section
                key={list.name}
                className="rounded-lg border border-foreground/10 bg-foreground/[0.03]"
              >
                <h2 className="px-4 py-3 border-b border-foreground/10 font-mono font-medium break-words">
                  {list.name}
                </h2>
                {list.items.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-foreground/50">
                    No items yet
                  </div>
                ) : (
                  <ul className="divide-y divide-foreground/5">
                    {list.items.map((item, index) => (
                      <li key={index} className="px-4 py-3 break-words">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          : draft.map((list, index) => (
              <ListEditor
                key={index}
                list={list}
                autoFocus={index === addedIndex}
                onChange={(next) =>
                  setDraft(
                    draft.map((other, i) => (i === index ? next : other))
                  )
                }
                onDelete={() => {
                  setAddedIndex(null);
                  setDraft(draft.filter((_, i) => i !== index));
                }}
              />
            ))}

        {draft !== null && (
          <button
            onClick={() => {
              setAddedIndex(draft.length);
              setDraft([...draft, { name: '', items: [] }]);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/20 py-3 text-sm text-foreground/60 hover:bg-foreground/5 active:opacity-80"
          >
            <Icon path={ICONS.add} />
            Add list
          </button>
        )}
      </main>
    </div>
  );
}
