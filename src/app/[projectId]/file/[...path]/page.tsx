import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProject } from '@/lib/projects';
import { readFile, getLanguageFromPath } from '@/lib/files';
import { join } from 'path';
import { codeToHtml } from 'shiki';

interface PageProps {
  params: Promise<{
    projectId: string;
    path: string[];
  }>;
}

export default async function FilePage({ params }: PageProps) {
  const { projectId, path } = await params;
  const project = getProject(projectId);

  if (!project) {
    notFound();
  }

  const filePath = path.map(decodeURIComponent).join('/');
  const fullPath = join(project.path, filePath);
  const language = getLanguageFromPath(fullPath);

  let content: string;
  let highlightedCode: string;

  try {
    content = readFile(fullPath);
    highlightedCode = await codeToHtml(content, {
      lang: language,
      theme: 'github-dark',
    });
  } catch {
    notFound();
  }

  const fileName = filePath.split('/').pop() || filePath;
  const lineCount = content.split('\n').length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/${projectId}`}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{fileName}</h1>
            <div className="text-xs text-foreground/50">
              {language} · {lineCount} lines
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-foreground/40 truncate">
          {filePath}
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div
          className="text-xs [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </main>
    </div>
  );
}
