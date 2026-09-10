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
  title: 'Khata — your own accountant',
  description:
    'Reads the bank alerts already in your Gmail and turns them into a ledger: what you spent, what you owe, what you lost. Nothing leaves your device.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Khata', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#f6f3ec',
  width: 'device-width',
  initialScale: 1,
  // The app is a fixed-width column; pinching it only ever breaks the layout.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}",
          }}
        />
      </body>
    </html>
  );
}
