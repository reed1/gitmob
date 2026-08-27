import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import GlobalUI from './GlobalUI';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// The icons are named here rather than dropped into `src/app/` as Next's file conventions: a
// convention file applies to every nested route as well, and /pinboard installs as its own PWA
// with its own icon. Each PWA's manifest is named by its own layout, so the root — which only
// redirects to /app — belongs to neither scope.
export const metadata: Metadata = {
  title: 'GitMob',
  description: 'Mobile-first git repository viewer',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.png', sizes: '180x180', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalUI />
        {children}
      </body>
    </html>
  );
}
