import type { SessionContext } from './ClaudeView';

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    const millions = tokens / 1000000;
    return `${millions % 1 === 0 ? millions : millions.toFixed(1)}M`;
  }
  if (tokens >= 10000) return `${Math.round(tokens / 1000)}k`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${tokens}`;
}

/** Under 10% a whole number hides most of the movement, and over it a decimal is noise. */
function formatPercentage(percentage: number): string {
  return percentage < 10
    ? `${percentage.toFixed(1)}%`
    : `${Math.round(percentage)}%`;
}

export function ContextUsage({ context }: { context: SessionContext | null }) {
  if (!context) {
    return <span className="text-foreground/40">context not reported yet</span>;
  }
  return (
    <>
      <span className="text-foreground/50">
        {formatTokens(context.usedTokens)} / {formatTokens(context.windowSize)}
      </span>{' '}
      <span className="text-blue-500">
        {formatPercentage(context.usedPercentage)}
      </span>
    </>
  );
}
