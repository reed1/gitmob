import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projects";
import { listDirectory, readFile, getLanguageFromPath } from "@/lib/files";
import { join } from "path";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const project = getProject(id);

    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const relativePath = searchParams.get("path") || "";
    const read = searchParams.get("read") === "true";

    const fullPath = relativePath
        ? join(project.path, relativePath)
        : project.path;

    if (read) {
        const content = readFile(fullPath);
        const language = getLanguageFromPath(fullPath);
        return NextResponse.json({ content, language });
    }

    const entries = listDirectory(fullPath);
    const relative = entries.map((e) => ({
        ...e,
        path: e.path.replace(project.path, "").replace(/^\//, ""),
    }));

    return NextResponse.json(relative);
}
