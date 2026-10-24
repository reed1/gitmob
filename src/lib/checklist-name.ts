/** A list's name is its file's name, so it is held to what a filename can safely be. */
export const CHECKLIST_NAME = /^[a-z]+(-[a-z]+)*$/;

export interface Checklist {
  name: string;
  items: string[];
}
