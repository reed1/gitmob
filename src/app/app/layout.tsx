import type { Metadata } from 'next';
import AppDepthTracker from './AppDepthTracker';
import ResumeAtHome from './ResumeAtHome';
import { Scratchpad } from './Scratchpad';

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
      <ResumeAtHome />
      {children}
      <Scratchpad />
    </>
  );
}
