import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checklist',
  description: 'What to bring, list by list',
  manifest: '/checklist.webmanifest',
  icons: {
    icon: [
      { url: '/checklist-favicon.ico', sizes: '32x32' },
      { url: '/checklist-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    apple: '/checklist-apple-icon.png',
  },
};

export default function ChecklistLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
