import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";

export interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
}

export function listDirectory(dir: string): FileEntry[] {
    const entries = readdirSync(dir, { withFileTypes: true });

    return entries
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => ({
            name: entry.name,
            path: join(dir, entry.name),
            isDirectory: entry.isDirectory(),
        }))
        .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
}

export function readFile(filePath: string): string {
    return readFileSync(filePath, "utf-8");
}

export function getFileInfo(filePath: string) {
    const stat = statSync(filePath);
    return {
        size: stat.size,
        modified: stat.mtime,
        isDirectory: stat.isDirectory(),
    };
}

export function getLanguageFromPath(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
        ".ts": "typescript",
        ".tsx": "tsx",
        ".js": "javascript",
        ".jsx": "jsx",
        ".py": "python",
        ".rs": "rust",
        ".go": "go",
        ".rb": "ruby",
        ".java": "java",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".php": "php",
        ".swift": "swift",
        ".kt": "kotlin",
        ".scala": "scala",
        ".sh": "bash",
        ".bash": "bash",
        ".zsh": "bash",
        ".fish": "fish",
        ".ps1": "powershell",
        ".sql": "sql",
        ".html": "html",
        ".htm": "html",
        ".css": "css",
        ".scss": "scss",
        ".sass": "sass",
        ".less": "less",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".xml": "xml",
        ".md": "markdown",
        ".mdx": "mdx",
        ".vue": "vue",
        ".svelte": "svelte",
        ".lua": "lua",
        ".vim": "viml",
        ".dockerfile": "dockerfile",
        ".toml": "toml",
        ".ini": "ini",
        ".cfg": "ini",
        ".conf": "ini",
        ".env": "dotenv",
    };

    return langMap[ext] || "plaintext";
}
