'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { createState, step, TICK, type Input, type State } from '@/lib/game/engine';
import { createScreenCanvas, renderScreen, VIEW_WIDTH } from '@/lib/game/screen';
import { isMuted, setMuted, sfx } from '@/lib/game/audio';
import { loadBest, loadMuted, saveBest, saveMuted } from '@/lib/game/storage';
import { DEFAULT_VIEW, ease, VIEW_MS, VIEWS } from '@/lib/scene/views';
import Machine from './Machine';
import Screen from './Screen';

const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW']);
const DUCK_CODES = new Set(['ArrowDown', 'KeyS']);

/**
 * Moves the camera between framed viewpoints.
 *
 * Position and look-at target are eased together — animating only the position
 * makes the machine appear to swing past the frame, because the camera keeps
 * staring at where it was aimed for the old shot.
 */
function CameraRig({ view }: { view: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const from = useRef({
    pos: new THREE.Vector3(...VIEWS[DEFAULT_VIEW].position),
    target: new THREE.Vector3(...VIEWS[DEFAULT_VIEW].target),
    fov: VIEWS[DEFAULT_VIEW].fov,
  });
  const start = useRef(0);
  const active = useRef(view);

  useEffect(() => {
    if (active.current === view) return;
    from.current = {
      pos: camera.position.clone(),
      target: new THREE.Vector3(...VIEWS[active.current].target),
      fov: camera.fov,
    };
    active.current = view;
    start.current = performance.now();
  }, [view, camera]);

  useFrame(() => {
    const target = VIEWS[view];
    const t = start.current === 0 ? 1 : Math.min(1, (performance.now() - start.current) / VIEW_MS);
    const e = ease(t);

    camera.position.lerpVectors(
      from.current.pos,
      new THREE.Vector3(...target.position),
      e,
    );
    const look = from.current.target.clone().lerp(new THREE.Vector3(...target.target), e);
    camera.lookAt(look);

    const fov = from.current.fov + (target.fov - from.current.fov) * e;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function Lighting() {
  const key = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const light = key.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -9;
    cam.right = 9;
    cam.top = 9;
    cam.bottom = -9;
    cam.near = 1;
    cam.far = 30;
    cam.updateProjectionMatrix();
  }, []);

  return (
    <>
      <ambientLight intensity={0.16} color="#c8d8e8" />
      <hemisphereLight args={['#dceaff', '#05070a', 0.22]} />
      <directionalLight
        ref={key}
        castShadow
        position={[4.5, 7.5, 5.5]}
        intensity={2.6}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0006}
        shadow-normalBias={0.025}
      />
      {/* Cool fill from the left keeps the beige from going flat and orange. */}
      {/* Rim from behind picks the translucent shell off the black ground. */}
      <directionalLight position={[-5, 3.5, -6]} intensity={1.5} color="#7fd4e8" />
      <directionalLight position={[6, 2.4, -5]} intensity={0.9} color="#ffd9b0" />
      <directionalLight position={[-6, 3, 4]} intensity={0.3} color="#cfe0ff" />
    </>
  );
}

export default function Game() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [phase, setPhase] = useState<State['phase']>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  const screenCanvas = useRef<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState<HTMLCanvasElement | null>(null);
  const dirty = useRef(0);

  const stateRef = useRef<State | null>(null);
  const pressed = useRef<Set<string>>(new Set());
  const input = useRef<Input>({ jump: false, duck: false, jumpPressed: false });
  const installEvent = useRef<Event | null>(null);
  /** When the last run ended, so a death press cannot instantly restart. */
  const diedAt = useRef(0);

  // One canvas for the life of the page; the texture is bound to it once.
  useEffect(() => {
    const canvas = createScreenCanvas();
    screenCanvas.current = canvas;
    setCanvasReady(canvas);

    const stored = loadBest();
    const s = createState(stored);
    s.viewWidth = VIEW_WIDTH;
    stateRef.current = s;
    setBest(stored);

    const startMuted = loadMuted();
    setMuted(startMuted);
    setMutedState(startMuted);
  }, []);

  const syncInput = useCallback(() => {
    const keys = pressed.current;
    const jump = [...JUMP_CODES].some((c) => keys.has(c));
    const duck = [...DUCK_CODES].some((c) => keys.has(c));
    if (jump && !input.current.jump) input.current.jumpPressed = true;
    input.current.jump = jump;
    input.current.duck = duck;
  }, []);

  const restart = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const fresh = createState(s.best);
    fresh.viewWidth = VIEW_WIDTH;
    fresh.phase = 'running';
    stateRef.current = fresh;
    pressed.current.clear();
    input.current = { jump: false, duck: false, jumpPressed: false };
  }, []);

  const press = useCallback(
    (code: string) => {
      if (pressed.current.has(code)) return;
      pressed.current.add(code);
      syncInput();

      // The engine only simulates while running; leaving the title and death
      // screens is the shell's job, not the simulation's.
      if (!JUMP_CODES.has(code)) return;
      const s = stateRef.current;
      if (!s) return;
      if (s.phase === 'ready') {
        s.phase = 'running';
      } else if (s.phase === 'dead' && performance.now() - diedAt.current > 450) {
        restart();
      }
    },
    [syncInput, restart],
  );

  const release = useCallback(
    (code: string) => {
      if (!pressed.current.delete(code)) return;
      syncInput();
    },
    [syncInput],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (JUMP_CODES.has(e.code) || DUCK_CODES.has(e.code)) {
        e.preventDefault();
        press(e.code);
      }
    };
    const up = (e: KeyboardEvent) => release(e.code);
    // Focus loss drops keyup, which would leave a key stuck down for ever.
    const blur = () => {
      pressed.current.clear();
      syncInput();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [press, release, syncInput]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installEvent.current = e;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // The simulation loop. Fixed 120Hz steps with an accumulator, so the physics
  // are identical whatever the display refresh rate is.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const rand = Math.random;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = stateRef.current;
      const canvas = screenCanvas.current;
      if (!s || !canvas) return;

      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;

      while (acc >= TICK) {
        step(s, input.current, rand);
        // The engine reads the rising edge but does not clear it, so the shell
        // has to — otherwise one press leaves the flag set and the runner jumps
        // again the instant it lands, for ever.
        input.current.jumpPressed = false;
        acc -= TICK;

        if (s.justJumped) sfx.jump();
        if (s.justMilestone) sfx.milestone();
        if (s.justDied) {
          sfx.die();
          diedAt.current = performance.now();
          if (s.score > s.best) {
            s.best = Math.floor(s.score);
            saveBest(s.best);
          }
          setBest(Math.floor(s.best));
        }
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderScreen(ctx, s);
        dirty.current += 1;
      }

      setPhase((p) => (p === s.phase ? p : s.phase));
      const rounded = Math.floor(s.score);
      setScore((v) => (v === rounded ? v : rounded));
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !muted;
    setMuted(next);
    saveMuted(next);
    setMutedState(next);
  }, [muted]);

  const install = useCallback(async () => {
    const e = installEvent.current as (Event & { prompt?: () => Promise<void> }) | null;
    if (!e?.prompt) return;
    await e.prompt();
    installEvent.current = null;
    setCanInstall(false);
  }, []);

  const hint = useMemo(() => {
    if (phase === 'ready') return 'Press space, or click the spacebar on screen';
    if (phase === 'dead') return 'Press space to run again';
    return 'Space to jump · ↓ to duck';
  }, [phase]);

  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{
          position: VIEWS[DEFAULT_VIEW].position,
          fov: VIEWS[DEFAULT_VIEW].fov,
          near: 0.1,
          far: 100,
        }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.02;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          scene.background = new THREE.Color('#000000');
          scene.fog = new THREE.Fog('#000000', 14, 30);
        }}
      >
        <CameraRig view={view} />
        <Lighting />
        <Machine
          pressedRef={pressed}
          onPress={press}
          onRelease={release}
          screen={<Screen canvas={canvasReady} dirty={dirty} />}
        />
      </Canvas>

      {/* Overlay chrome. Nothing here rotates the scene — that is the buttons' job. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-[#eef4f6]">Runner</h1>
            <p className="mt-0.5 text-[12px] text-[#8b979c]">Runs with no connection</p>
          </div>
          <div className="mono flex items-baseline gap-4 text-[#eef4f6]">
            <span className="text-[22px] tabular-nums">
              {String(score).padStart(5, '0')}
            </span>
            <span className="text-[12px] text-[#8b979c]">
              best {String(best).padStart(5, '0')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            {VIEWS.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setView(i)}
                aria-pressed={view === i}
                className={`min-h-[38px] rounded-full px-4 text-[13px] transition-colors ${
                  view === i
                    ? 'bg-[#eef4f6] font-semibold text-[#0a0d0f]'
                    : 'bg-white/10 text-[#dfe7ea] hover:bg-white/20'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <p className="text-[12px] text-[#8b979c]">{hint}</p>
            <div className="pointer-events-auto flex gap-1.5">
              {phase === 'dead' && (
                <button
                  onClick={restart}
                  className="min-h-[38px] rounded-full bg-[#eef4f6] px-4 text-[13px] font-semibold text-[#0a0d0f]"
                >
                  Run again
                </button>
              )}
              {canInstall && (
                <button
                  onClick={install}
                  className="min-h-[38px] rounded-full bg-white/10 px-4 text-[13px] text-[#dfe7ea] hover:bg-white/20"
                >
                  Install
                </button>
              )}
              <button
                onClick={toggleSound}
                className="min-h-[38px] rounded-full bg-white/10 px-4 text-[13px] text-[#dfe7ea] hover:bg-white/20"
              >
                {muted ? 'Sound off' : 'Sound on'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { isMuted };
