import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest.json',
};

export default function GitMobLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
