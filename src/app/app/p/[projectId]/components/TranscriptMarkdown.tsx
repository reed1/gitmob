import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-base font-semibold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-[0.95rem] font-semibold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-medium text-foreground/80">
      {children}
    </h4>
  ),
  ul: ({ children }) => (
    <ul className="my-2 pl-5 list-disc space-y-1 marker:text-foreground/40">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 pl-5 list-decimal space-y-1 marker:text-foreground/40">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-500 underline underline-offset-2 break-all"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-foreground/20 text-foreground/70">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-foreground/10" />,
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded bg-foreground/10 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  // A fenced block's code element is styled through its pre, which undoes the inline chip.
  pre: ({ children }) => (
    <pre className="my-2 p-3 rounded-lg bg-foreground/5 border border-foreground/10 overflow-x-auto text-xs leading-relaxed [&_code]:p-0 [&_code]:bg-transparent [&_code]:text-xs">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-foreground/5">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-semibold border-b border-foreground/15">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 align-top border-t border-foreground/10">
      {children}
    </td>
  ),
};

export function TranscriptMarkdown({ content }: { content: string }) {
  return (
    <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
