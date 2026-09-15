import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Literata } from 'next/font/google';
import './globals.css';

/*
 * Two faces doing two jobs. English being taught is set in Literata, a reading
 * face with the weight of a dictionary entry; the interface around it is in
 * Hanken Grotesk and stays out of the way. The split is the point — the
 * language is the content, not furniture.
 */
const read = Literata({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-read',
  display: 'swap',
});

const ui = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mynah',
  description:
    'An English course that teaches from your mistakes. Free, offline, no ads, no lives to lose.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#101214' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${read.variable} ${ui.variable}`}>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%90%A6</text></svg>"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
