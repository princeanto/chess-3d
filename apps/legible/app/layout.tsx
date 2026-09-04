import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const ui = Archivo({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Legible — contrast auditor for design systems',
  description:
    'Paste a palette and get every foreground/background pair graded against WCAG 2.2. Failing pairs are nudged in OKLCH to the nearest passing value, holding hue so the brand survives the fix.',
};

export const viewport: Viewport = {
  themeColor: '#fbfaf8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <head>
        {/*
          Theme is resolved before first paint. Doing this in an effect would
          flash a light interface at anyone auditing a dark palette.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('legible-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
