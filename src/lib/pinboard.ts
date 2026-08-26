import { execFile } from 'child_process';
import { getProjects } from './projects';

export interface PinboardNote {
  id: number;
  text: string;
  /** rv sends null, not an absent key, for a note it has no stamp for. */
  createdAt: string | null;
  editedAt: string | null;
}

interface RvNote {
  id: number;
  text: string;
  created_at?: string | null;
  edited_at?: string | null;
}

/**
 * `rv pinboard` owns the board files: it maps a project id to its board, hands every write to
 * the pinboard CLI so ids, placement, palette and timestamps stay that app's business, and
 * commits the pinboard-data repo afterwards.
 */
function runRvPinboard(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'rv',
      ['pinboard', ...args],
      { timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || stdout.trim() || error.message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

export async function getPinboardNotes(
  projectId: string
): Promise<PinboardNote[]> {
  const stdout = await runRvPinboard([
    'list',
    '--project-id',
    projectId,
    '--json',
  ]);
  const notes: RvNote[] = JSON.parse(stdout);

  return notes.map((note) => ({
    id: note.id,
    text: note.text,
    createdAt: note.created_at ?? null,
    editedAt: note.edited_at ?? null,
  }));
}

export async function addPinboardNote(
  projectId: string,
  text: string
): Promise<void> {
  await runRvPinboard(['add', '--project-id', projectId, text]);
}

export async function editPinboardNote(
  projectId: string,
  noteId: number,
  text: string
): Promise<void> {
  await runRvPinboard([
    'edit',
    '--project-id',
    projectId,
    String(noteId),
    text,
  ]);
}

export async function deletePinboardNote(
  projectId: string,
  noteId: number
): Promise<void> {
  await runRvPinboard(['delete', '--project-id', projectId, String(noteId)]);
}

export interface RecentPinboardNote extends PinboardNote {
  projectId: string;
}

export interface RecentPinboardNotes {
  notes: RecentPinboardNote[];
  failures: { projectId: string; error: string }[];
  projectCount: number;
}

/** Newest first, by the last time the note was touched; an undated note sorts to the end. */
function recency(note: PinboardNote): number {
  const stamp = note.editedAt ?? note.createdAt;
  return stamp ? Date.parse(stamp) : 0;
}

const BOARD_READ_CONCURRENCY = 8;

/**
 * Every board at once, newest notes first. `rv pinboard` answers one project per call, so this
 * fans out over the configured projects — worktrees share the board of the project they are a
 * checkout of, and would only duplicate it.
 */
export async function getRecentPinboardNotes(
  limit: number
): Promise<RecentPinboardNotes> {
  const projectIds = getProjects().map((project) => project.id);
  const notes: RecentPinboardNote[] = [];
  const failures: { projectId: string; error: string }[] = [];

  let next = 0;
  const readBoards = async () => {
    while (next < projectIds.length) {
      const projectId = projectIds[next++];
      // One board rv cannot read is worth a warning, not an empty overview of the others.
      try {
        for (const note of await getPinboardNotes(projectId)) {
          notes.push({ ...note, projectId });
        }
      } catch (err) {
        failures.push({
          projectId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(BOARD_READ_CONCURRENCY, projectIds.length) },
      readBoards
    )
  );

  notes.sort((a, b) => recency(b) - recency(a));
  return {
    notes: notes.slice(0, limit),
    failures,
    projectCount: projectIds.length,
  };
}
