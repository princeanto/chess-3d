import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Creative tools that work anywhere. Color, type, shape, draw, make, play. No account. No internet.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Playground',
  appleWebApp: { capable: true, title: 'Playground', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icon-192.png', sizes: '192x192' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F2' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

/*
 * Applies a saved Light or Dark choice before first paint, so someone who
 * picked Dark never sees a flash of the light theme on load.
 */
const THEME_BOOT = `try{var t=JSON.parse(localStorage.getItem('playground.theme')||'"system"');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
