import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Mono } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Runner — the offline dinosaur game, rebuilt',
  description:
    'An endless runner that works with no internet connection. Install it and it keeps running offline.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Runner', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#f2efe9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
