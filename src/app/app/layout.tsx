import type { Metadata } from 'next';
import AppDepthTracker from './AppDepthTracker';

export const metadata: Metadata = {
  manifest: '/manifest.json',
};

export default function GitMobLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AppDepthTracker />
      {children}
    </>
  );
}
