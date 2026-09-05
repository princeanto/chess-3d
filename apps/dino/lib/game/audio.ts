/**
 * Sound, synthesised on the fly.
 *
 * Every tone is generated with an oscillator rather than loaded from a file.
 * That keeps the app at zero binary assets — which matters here, because
 * anything the service worker has to cache is another thing that can be missing
 * when the player is offline.
 */

let ctx: AudioContext | null = null;
let muted = false;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers start the context suspended until a gesture; every entry point
  // here follows a key press or tap, so resuming is safe.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  gain = 0.05,
  slideTo?: number,
) {
  if (muted) return;
  const ac = context();
  if (!ac) return;

  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + duration);
  }

  // A short attack and exponential release: an instant cut clicks audibly.
  env.gain.setValueAtTime(0.0001, ac.currentTime);
  env.gain.exponentialRampToValueAtTime(gain, ac.currentTime + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

  osc.connect(env).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.02);
}

export const sfx = {
  jump: () => tone(420, 0.13, 'square', 0.045, 720),
  land: () => tone(180, 0.07, 'sine', 0.03),
  point: () => tone(880, 0.07, 'square', 0.028),
  milestone: () => {
    tone(880, 0.09, 'square', 0.04);
    setTimeout(() => tone(1320, 0.14, 'square', 0.04), 90);
  },
  die: () => {
    tone(340, 0.18, 'sawtooth', 0.05, 90);
    setTimeout(() => tone(150, 0.3, 'square', 0.04, 60), 110);
  },
};

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}
