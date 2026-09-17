/**
 * A soft three-note chime, synthesised — no audio file to download or cache.
 * Browsers only allow sound after a tap, so `prime` is called from the Start
 * button and `chime` can play later when the timer ends.
 */

let context: AudioContext | null = null;

export function prime(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!context && Ctor) context = new Ctor();
    void context?.resume();
  } catch {
    /* silent is fine */
  }
}

export function chime(): void {
  try {
    if (!context) prime();
    const ctx = context;
    if (!ctx) return;
    [0, 0.2, 0.4].forEach((at, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = [784, 988, 1175][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.65);
    });
  } catch {
    /* ignore */
  }
  try { navigator.vibrate?.([160, 90, 160]); } catch { /* ignore */ }
}
