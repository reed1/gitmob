import { redirect } from 'next/navigation';

// GitMob itself lives under /app so its PWA scope stays clear of /pinboard's; the root is kept
// free of both, and only forwards.
export default function RootRedirect() {
  redirect('/app');
}
