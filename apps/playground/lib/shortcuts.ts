/**
 * When a keypress belongs to the app, and when it belongs to what has focus.
 *
 * Single-letter shortcuts are wonderful until you type "CREATE" into a text
 * field and get sent to Color on the first key. So plain keys stand down while
 * you are typing, and Space stands down while a control that Space already
 * operates has focus — a keyboard user pressing Space on a lock button means
 * "toggle this lock", not "throw the palette away".
 */

interface ElementLike {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

const TEXT_INPUTS = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/** A field you can type words into. Sliders and colour pickers are not. */
export function isEditable(target: EventTarget | ElementLike | null): boolean {
  const el = target as ElementLike | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return TEXT_INPUTS.has((el.type ?? '').toLowerCase());
  return false;
}

const SPACE_ROLES = new Set(['button', 'checkbox', 'radio', 'switch', 'menuitem', 'option', 'tab', 'slider']);

/** A control where Space already means something. */
export function spaceIsTaken(target: EventTarget | ElementLike | null): boolean {
  const el = target as ElementLike | null;
  if (!el || !el.tagName) return false;
  if (isEditable(el)) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A') return true;
  if (tag === 'INPUT') return true;
  const role = el.getAttribute?.('role');
  return role ? SPACE_ROLES.has(role) : false;
}

/** ⌘ on Apple devices, Ctrl everywhere else. */
export const modLabel = (): string =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
