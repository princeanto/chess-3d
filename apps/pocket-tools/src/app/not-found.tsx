import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <p className="eyebrow">404</p>
      <h1 className="page-title">Nothing here yet.</h1>
      <p className="page-line">That page doesn’t exist. The tools do.</p>
      <p><Link href="/" className="btn btn-primary">Find a tool</Link></p>
    </div>
  );
}
