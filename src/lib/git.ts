import { execSync } from "child_process";

export interface GitStatus {
    staged: FileChange[];
    unstaged: FileChange[];
    untracked: string[];
}

export interface FileChange {
    path: string;
    status: "M" | "A" | "D" | "R" | "C" | "U" | "?";
}

export interface DiffHunk {
    header: string;
    lines: DiffLine[];
}

export interface DiffLine {
    type: "context" | "add" | "remove" | "header";
    content: string;
    oldLineNo?: number;
    newLineNo?: number;
}

function git(cwd: string, args: string): string {
    return execSync(`git ${args}`, { cwd, encoding: "utf-8" });
}

export function getStatus(cwd: string): GitStatus {
    const output = git(cwd, "status --porcelain");
    const lines = output.trim().split("\n").filter(Boolean);

    const staged: FileChange[] = [];
    const unstaged: FileChange[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
        const index = line[0];
        const worktree = line[1];
        const path = line.slice(3);

        if (index === "?") {
            untracked.push(path);
        } else {
            if (index !== " " && index !== "?") {
                staged.push({ path, status: index as FileChange["status"] });
            }
            if (worktree !== " " && worktree !== "?") {
                unstaged.push({ path, status: worktree as FileChange["status"] });
            }
        }
    }

    return { staged, unstaged, untracked };
}

export function getDiff(cwd: string, staged: boolean = false): string {
    const flag = staged ? "--cached" : "";
    return git(cwd, `diff ${flag}`);
}

export function getFileDiff(
    cwd: string,
    filePath: string,
    staged: boolean = false
): string {
    const flag = staged ? "--cached" : "";
    return git(cwd, `diff ${flag} -- "${filePath}"`);
}

export function stageFile(cwd: string, filePath: string): void {
    git(cwd, `add "${filePath}"`);
}

export function unstageFile(cwd: string, filePath: string): void {
    git(cwd, `reset HEAD "${filePath}"`);
}

export function discardChanges(cwd: string, filePath: string): void {
    git(cwd, `checkout -- "${filePath}"`);
}

export function commit(cwd: string, message: string): string {
    return git(cwd, `commit -m "${message.replace(/"/g, '\\"')}"`);
}

export function pull(cwd: string): string {
    return git(cwd, "pull");
}

export function push(cwd: string): string {
    return git(cwd, "push");
}

export function getBranch(cwd: string): string {
    return git(cwd, "branch --show-current").trim();
}

export function getLog(cwd: string, count: number = 10): string {
    return git(cwd, `log --oneline -n ${count}`);
}
