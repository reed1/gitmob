'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function TtydPage() {
  return (
    <Suspense>
      <TtydWrapper />
    </Suspense>
  );
}

function TtydWrapper() {
  const searchParams = useSearchParams();
  const ttydUrl = searchParams.get('url');
  const tmuxSession = searchParams.get('session');
  const [inputOpen, setInputOpen] = useState(false);
  const [text, setText] = useState('');
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLockedHeight(window.innerHeight);
  }, []);

  useEffect(() => {
    if (inputOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [inputOpen]);

  async function handleSend(enter: boolean) {
    if (!tmuxSession || !text) return;
    await apiFetch('/api/ttyd-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmuxSession, text, enter }),
    });
    setText('');
    setInputOpen(false);
  }

  if (!ttydUrl || !tmuxSession) {
    return (
      <div className="p-4 text-red-500">Missing url or session parameter</div>
    );
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 flex flex-col bg-black overflow-hidden"
      style={lockedHeight ? { height: `${lockedHeight}px` } : { bottom: 0 }}
    >
      <iframe
        src={ttydUrl}
        className="flex-1 w-full border-none"
        allow="clipboard-read; clipboard-write"
      />

      <button
        onClick={() => setInputOpen(true)}
        className="w-full py-1 bg-zinc-800 text-zinc-400 text-xs border-t border-zinc-700 active:bg-zinc-700"
      >
        Voice Input
      </button>

      {inputOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          <div className="w-full bg-zinc-900 p-3 space-y-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(true);
                }
              }}
              placeholder="Speak or type here..."
              rows={3}
              className="w-full p-3 rounded bg-zinc-800 text-white text-base border border-zinc-600 resize-none focus:outline-none focus:border-zinc-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInputOpen(false);
                  setText('');
                }}
                className="flex-1 py-2 rounded bg-zinc-700 text-zinc-300 text-sm active:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSend(false)}
                className="flex-1 py-2 rounded bg-blue-600 text-white text-sm active:bg-blue-500"
              >
                Send
              </button>
              <button
                onClick={() => handleSend(true)}
                className="flex-1 py-2 rounded bg-green-600 text-white text-sm active:bg-green-500"
              >
                Send + Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
