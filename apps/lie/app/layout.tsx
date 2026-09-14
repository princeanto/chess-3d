import type { Metadata, Viewport } from 'next';
import { Gabarito, Unbounded } from 'next/font/google';
import './globals.css';

/* Unbounded carries the jokes and the numbers; Gabarito does the reading. */
const display = Unbounded({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Gabarito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Spot the Lie',
  description:
    'Four statements a round, three of them true and one invented. Three wrong answers and you start over.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffcf4' },
    { media: '(prefers-color-scheme: dark)', color: '#131316' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%95%B5%EF%B8%8F</text></svg>"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
