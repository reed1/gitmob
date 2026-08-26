import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pinboard',
  description: 'Recent pinboard notes from every project',
  manifest: '/pinboard.webmanifest',
  icons: {
    icon: [
      { url: '/pinboard-favicon.ico', sizes: '32x32' },
      { url: '/pinboard-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    apple: '/pinboard-apple-icon.png',
  },
};

export default function PinboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
