import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './fonts.css';
import './globals.css';
import './tools.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: { default: 'Pocket Tools — Small problems. Solved quickly.', template: '%s · Pocket Tools' },
  description: 'Tiny utilities for everyday life. Compress images, split bills, convert units, make QR codes — on your device, offline, with no account.',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icon-192.png', sizes: '192x192' }], apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Pocket Tools', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F2' },
    { media: '(prefers-color-scheme: dark)', color: '#121211' },
  ],
};

/* Light unless you chose otherwise, applied before the first paint so dark mode never flashes white. */
const THEME_BOOT = `try{var t=JSON.parse(localStorage.getItem('pocket.theme')),r=document.documentElement;if(t==='system')delete r.dataset.theme;else r.dataset.theme=t==='dark'?'dark':'light'}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
