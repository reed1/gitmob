'use client';

import { useState } from 'react';

export function CLIView({ projectPath }: { projectPath: string }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [notify, setNotify] = useState(false);
  const [loading, setLoading] = useState(false);

  const runCommand = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setOutput(null);
    setExitCode(null);
    const res = await fetch('/api/cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd: projectPath, notify }),
    });
    const data = await res.json();
    setOutput(data.output);
    setExitCode(data.exitCode);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      runCommand();
    }
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter command..."
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full px-3 py-2 bg-foreground/5 border border-foreground/10 rounded-lg text-sm font-mono"
      />
      <div className="flex items-center justify-between mt-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="w-4 h-4"
          />
          Notify
        </label>
        <button
          onClick={runCommand}
          disabled={loading || !command.trim()}
          className="px-4 py-2 bg-foreground text-background font-medium rounded-lg active:opacity-80 disabled:opacity-50"
        >
          {loading ? 'Running...' : 'Run'}
        </button>
      </div>

      {output !== null && (
        <pre className="mt-4 flex-1 p-3 bg-foreground/5 border border-foreground/10 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-auto">
          {output || '(no output)'}
        </pre>
      )}

      {exitCode !== null && (
        <div className="mt-2 text-sm">
          <span className="font-medium">Return Code: </span>
          <span className={exitCode === 0 ? 'text-green-600' : 'text-red-600'}>
            {exitCode}
          </span>
        </div>
      )}
    </div>
  );
}
