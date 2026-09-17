import type { Metadata } from 'next';
import Link from 'next/link';
import { TOOLS } from '@/data/tools';

export const metadata: Metadata = { title: 'About' };

export default function About() {
  return (
    <div className="page page-narrow about">
      <h1 className="about-title">Pocket Tools</h1>
      <p className="about-tag">Small problems. Solved quickly.</p>
      <p className="about-lead">
        {TOOLS.length} tiny utilities for the annoying little jobs that come up every day — a photo that’s too big to upload,
        a bill to split, a date to count down to.
      </p>
      <ul className="about-list">
        <li><strong>Fast.</strong> Open a tool, get the answer, leave.</li>
        <li><strong>Private.</strong> Everything happens in your browser. Your files and your numbers never leave your device.</li>
        <li><strong>Offline.</strong> After the first visit it keeps working with no connection at all.</li>
        <li><strong>Useful.</strong> One job per tool, done properly.</li>
      </ul>
      <p className="about-note">No account required. No uploads. No tracking.</p>
      <p className="about-note">
        QR codes are made with <em>qrcode-generator</em> by Kazuhiko Arase (MIT). The typeface is Inter by Rasmus Andersson (SIL Open Font License).
        “QR Code” is a registered trademark of DENSO WAVE.
      </p>
      <p className="about-back"><Link href="/" className="btn btn-primary">Find a tool</Link></p>
    </div>
  );
}
