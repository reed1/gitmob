import { redirect } from 'next/navigation';

// Only reached on a host src/proxy.ts cannot name — a dev host or localhost, which serve both
// apps. On gitmob.<front> and pinboard.<front> the proxy has already sent `/` to the right app.
export default function RootRedirect() {
  redirect('/app');
}
