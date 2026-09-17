/* Small, drawn to a 16px grid, stroked in currentColor so they follow the swatch. */

export function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.25" y="7.25" width="9.5" height="6.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" fill={locked ? 'currentColor' : 'none'} />
      <path d={locked ? 'M5.5 7.25V5.25a2.5 2.5 0 0 1 5 0v2' : 'M5.5 7.25V5.25a2.5 2.5 0 0 1 4.9-.7'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8a5 5 0 1 1-1.46-3.54" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 2.75V5.5h-2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
