import Link from 'next/link';

/** pocket.tools — the dot is the only mark. */
export default function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" className="logo" aria-label="Pocket Tools, home" onClick={onClick}>
      <span className="logo-pocket">pocket</span>
      <span className="logo-dot" aria-hidden="true" />
      <span className="logo-tools">tools</span>
    </Link>
  );
}
