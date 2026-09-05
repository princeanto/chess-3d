import Game from '@/components/Game';

export default function Page() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[1120px] flex-col justify-center gap-7 px-4 py-8 sm:px-7">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <h1 className="display text-[42px] sm:text-[52px]">
            <span style={{ color: 'var(--ink)' }}>Runner</span>
            <br />
            <span style={{ color: 'var(--ghost)' }}>No signal needed</span>
          </h1>
        </div>
        <p className="max-w-[36ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
          The game you get when the connection drops, rebuilt — parallax dunes, a day that
          turns to night, and physics that behave the same on any screen.
        </p>
      </header>

      <Game />
    </main>
  );
}
