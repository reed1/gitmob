/** Shiki's HTML for a whole file, on the page's own background. */
export function HighlightedCode({
  html,
  wordWrap,
}: {
  html: string;
  wordWrap: boolean;
}) {
  return (
    <div
      className={`text-xs font-mono [&_pre]:!bg-transparent [&_pre]:p-4 [&_code]:!bg-transparent ${
        wordWrap ? '[&_pre]:whitespace-pre-wrap' : '[&_pre]:overflow-x-auto'
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
