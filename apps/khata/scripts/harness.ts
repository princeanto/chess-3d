/**
 * A test runner in thirty lines.
 *
 * The repo's other apps do the same thing: assertions that print what they
 * actually saw, so a failure tells you the number rather than only that a
 * number was wrong.
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function section(title: string): void {
  console.log(`\n${title.toUpperCase()}`);
}

export function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `  ${detail}` : ''}`);
  }
}

export function eq<T>(label: string, actual: T, expected: T): void {
  ok(label, Object.is(actual, expected), `got ${String(actual)}, expected ${String(expected)}`);
}

export function near(label: string, actual: number, expected: number, slack: number): void {
  ok(
    label,
    Math.abs(actual - expected) <= slack,
    `got ${actual}, expected ${expected} ±${slack}`,
  );
}

export function report(): void {
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
}
