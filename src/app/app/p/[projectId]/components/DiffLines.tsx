export function DiffLines({
  diff,
  wordWrap,
}: {
  diff: string;
  wordWrap: boolean;
}) {
  return (
    <div
      className={
        wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre w-max min-w-full'
      }
    >
      {diff.split('\n').map((line, i) => {
        let className = 'text-foreground/70';
        if (line.startsWith('+') && !line.startsWith('+++')) {
          className = 'text-green-400 bg-green-400/10';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          className = 'text-red-400 bg-red-400/10';
        } else if (line.startsWith('@@')) {
          className = 'text-blue-400';
        }
        return (
          <div key={i} className={className}>
            {line}
          </div>
        );
      })}
    </div>
  );
}
