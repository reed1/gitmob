'use client';

import { useState } from 'react';

export function CLIView({ projectPath }: { projectPath: string }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runCommand = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setOutput(null);
    const res = await fetch('/api/cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd: projectPath }),
    });
    const data = await res.json();
    setOutput(data.output);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      runCommand();
    }
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          autoCapitalize="off"
          className="flex-1 px-3 py-2 bg-foreground/5 border border-foreground/10 rounded-lg text-sm font-mono"
        />
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
    </div>
  );
}
