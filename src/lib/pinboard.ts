import { execFile } from 'child_process';

export interface PinboardNote {
  id: number;
  text: string;
  createdAt?: string;
  editedAt?: string;
}

interface RvNote {
  id: number;
  text: string;
  created_at?: string;
  edited_at?: string;
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
  const stdout = await runRvPinboard(['list', '--project-id', projectId, '--json']);
  const notes: RvNote[] = JSON.parse(stdout);

  return notes.map((note) => ({
    id: note.id,
    text: note.text,
    createdAt: note.created_at,
    editedAt: note.edited_at,
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
  await runRvPinboard(['edit', '--project-id', projectId, String(noteId), text]);
}

export async function deletePinboardNote(
  projectId: string,
  noteId: number
): Promise<void> {
  await runRvPinboard(['delete', '--project-id', projectId, String(noteId)]);
}
