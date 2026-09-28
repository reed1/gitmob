const MODEL = 'gpt-5.4-mini';

const INSTRUCTIONS =
  'Name a git branch for the work described. Answer with the name only: <type>/<words>, ' +
  'where type is one of feat, fix, refactor, chore, docs and words are lowercase and joined ' +
  'by hyphens. Aim for three words or fewer after the slash.';

interface ChatCompletion {
  choices: { message: { content: string | null } }[];
}

/**
 * A branch name for the work an opening prompt describes, to fill the box with before a worktree
 * is made for it. Only a suggestion: the box stays editable, and git judges the name on Create.
 *
 * OpenAI rather than Claude because this waits on a tap: `claude -p` spends ~12s starting up
 * before Haiku says anything, where this answers in about one. Reasoning is off for the same
 * reason — naming a branch needs none.
 */
export async function suggestBranchName(description: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: 'none',
      messages: [
        { role: 'system', content: INSTRUCTIONS },
        { role: 'user', content: description },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`OpenAI answered ${res.status}: ${await res.text()}`);
  }

  const completion: ChatCompletion = await res.json();
  const answer = completion.choices[0]?.message.content ?? '';
  const branch = answer
    .trim()
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9/._-]/g, '');

  if (branch === '') {
    throw new Error(`No branch name in ${JSON.stringify(answer)}`);
  }
  return branch;
}
