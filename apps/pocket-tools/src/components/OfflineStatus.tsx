'use client';

import { useApp, type OfflineState } from './AppState';

const LABEL: Record<OfflineState, string> = {
  ready: 'Offline ready',
  offline: 'Offline — still works',
  saving: 'Saving for offline…',
  local: 'Works offline',
};

/** "Offline ready" only once the app really is saved on this device. */
export default function OfflineStatus({ compact = false }: { compact?: boolean }) {
  const { offline } = useApp();
  return (
    <p className={`status status-${offline}${compact ? ' status-compact' : ''}`} title={LABEL[offline]}>
      <span className="status-dot" aria-hidden="true" />
      <span className={compact ? 'sr-only' : ''}>{LABEL[offline]}</span>
    </p>
  );
}
