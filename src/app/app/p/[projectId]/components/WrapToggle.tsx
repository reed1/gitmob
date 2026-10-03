export function WrapToggle({
  wordWrap,
  setWordWrap,
}: {
  wordWrap: boolean;
  setWordWrap: (wordWrap: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground/60 cursor-pointer">
      <input
        type="checkbox"
        checked={wordWrap}
        onChange={(e) => setWordWrap(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-5 h-5 rounded border-2 border-foreground/30 peer-checked:bg-foreground peer-checked:border-foreground flex items-center justify-center">
        {wordWrap && (
          <svg
            className="w-3 h-3 text-background"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      Wrap
    </label>
  );
}
