'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createState, step, TICK, type Input, type State } from '@/lib/game/engine';
import { createScreenCanvas, renderScreen, VIEW_WIDTH } from '@/lib/game/screen';
import { isMuted, setMuted, sfx } from '@/lib/game/audio';
import { loadBest, loadMuted, saveBest, saveMuted } from '@/lib/game/storage';
import { DEFAULT_VIEW, ease, VIEW_MS, VIEWS } from '@/lib/scene/views';
import Machine from './Machine';
import Screen from './Screen';

/** Fractal noise, inline, so the grain costs no request and no library. */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;

const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW']);
const DUCK_CODES = new Set(['ArrowDown', 'KeyS']);

/**
 * Moves the camera between framed viewpoints.
 *
 * Position and look-at target are eased together — animating only the position
 * makes the machine appear to swing past the frame, because the camera keeps
 * staring at where it was aimed for the old shot.
 */
function CameraRig({
  view,
  free,
  look,
}: {
  view: number;
  /** True while the mouse owns the camera; the rig keeps its hands off. */
  free: boolean;
  /** Where the camera is aimed, shared with the free-look controls. */
  look: React.MutableRefObject<THREE.Vector3>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const from = useRef({
    pos: new THREE.Vector3(...VIEWS[DEFAULT_VIEW].position),
    target: new THREE.Vector3(...VIEWS[DEFAULT_VIEW].target),
    fov: VIEWS[DEFAULT_VIEW].fov,
  });
  const start = useRef(0);
  const active = useRef(view);
  const wasFree = useRef(false);

  useEffect(() => {
    if (free) {
      wasFree.current = true;
      return;
    }
    // Coming back from free look counts as a change even if the framed view
    // has not: the camera is wherever the user left it, so it has to fly home.
    if (active.current === view && !wasFree.current) return;
    from.current = {
      pos: camera.position.clone(),
      target: look.current.clone(),
      fov: camera.fov,
    };
    active.current = view;
    wasFree.current = false;
    start.current = performance.now();
  }, [view, free, camera, look]);

  useFrame(() => {
    if (free) return;
    const target = VIEWS[view];
    const t = start.current === 0 ? 1 : Math.min(1, (performance.now() - start.current) / VIEW_MS);
    const e = ease(t);

    camera.position.lerpVectors(
      from.current.pos,
      new THREE.Vector3(...target.position),
      e,
    );
    const aim = from.current.target.clone().lerp(new THREE.Vector3(...target.target), e);
    camera.lookAt(aim);
    look.current.copy(aim);

    const fov = from.current.fov + (target.fov - from.current.fov) * e;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/**
 * Mouse control of the camera, for looking the machine over.
 *
 * Deliberately not the default: every framed view is one that was composed on
 * purpose, and the game itself wants the screen square on. This is the escape
 * hatch for inspecting the object, so it stays off until asked for.
 */
function FreeLook({ look }: { look: React.MutableRefObject<THREE.Vector3> }) {
  return (
    <OrbitControls
      makeDefault
      target={look.current}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.4}
      maxDistance={16}
      // Stop just above the desk, so the camera never ends up underneath it.
      maxPolarAngle={Math.PI / 2 - 0.03}
      onChange={(e) => {
        const controls = e?.target as { target?: THREE.Vector3 } | undefined;
        if (controls?.target) look.current.copy(controls.target);
      }}
    />
  );
}

function Lighting() {
  const key = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const light = key.current;
    if (!light) return;
    const cam = light.shadow.camera;
    // Wide enough for the whole room, not just the desk.
    cam.left = -15;
    cam.right = 15;
    cam.top = 15;
    cam.bottom = -15;
    cam.near = 1;
    cam.far = 60;
    cam.updateProjectionMatrix();
  }, []);

  return (
    <>
      {/*
        A lamplit room after dark, so the rig is warm and low.

        The two desk lamps and a fitting over the desk carry it as real lights;
        this is the fill around them. It stays warm and well under a daylit
        studio's key, because the wall's wash and the desk's pool are painted
        into their textures and lighting them a second time flattens both — but
        it is no longer so low that the room goes black a metre from the desk.
      */}
      {/*
        Even, and enough of it.
        
        The walls carry no baked light any more, so this has to do the work that
        their painted-in gradients were doing. Warm but close to neutral, so the
        same paint reads the same on both walls.
      */}
      <ambientLight intensity={1.15} color="#fff1e0" />
      <hemisphereLight args={['#fff4e6', '#6b5a48', 0.75]} />
      {/* Same direction as before, moved out so its shadow camera can cover the
          whole room rather than just the desk. */}
      <directionalLight
        ref={key}
        castShadow
        position={[9.2, 22.6, 14.8]}
        intensity={1.35}
        color="#ffe2c0"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0006}
        shadow-normalBias={0.025}
      />
      {/*
        Two cool slivers, front and back. Under warm light alone the shell's
        Bondi went to beige and the machine stopped being blue at all; these are
        what keep the colour in it without cooling the room.
      */}
      <directionalLight position={[-5, 3.5, -6]} intensity={0.7} color="#8fc8dc" />
      <directionalLight position={[-3.5, 3, 6]} intensity={0.45} color="#a8d4e4" />
      {/* Colour for its own sake, low and from the corners — the accent the
          room gets instead of walls painted in different tones. */}
      <pointLight position={[-5.4, 0.9, 4.6]} intensity={7} distance={11} decay={2} color="#5fb8d8" />
      <pointLight position={[5.6, 1.3, -2.6]} intensity={6} distance={11} decay={2} color="#e2657f" />
    </>
  );
}

export default function Game() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [free, setFree] = useState(false);
  const look = useRef(new THREE.Vector3(...VIEWS[DEFAULT_VIEW].target));
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
    // Free look changes what the mouse does, so it gets to say so.
    if (free) return 'Drag to orbit · scroll to zoom · right-drag to pan';
    if (phase === 'ready') return 'Press space, or click the spacebar on screen';
    if (phase === 'dead') return 'Press space to run again';
    return 'Space to jump · ↓ to duck';
  }, [phase, free]);

  return (
    <div className="fixed inset-0 bg-[#f4f2ee]">
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
          gl.toneMappingExposure = 0.94;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          // White surround: the room is a diorama, and a black void around it read
          // as a hole rather than as a backdrop.
          scene.background = new THREE.Color('#f4f2ee');
          /*
           * No fog.
           *
           * It existed to hide the horizon of an infinite floor. The room is a
           * bounded box now, and the fog ended at 30 units — which put the
           * isometric camera, 50 out, behind a wall of black. The room simply
           * did not render.
           */
        }}
      >
        <CameraRig view={view} free={free} look={look} />
        {free && <FreeLook look={look} />}
        <Lighting />
        <Machine
          pressedRef={pressed}
          onPress={press}
          onRelease={release}
          screen={<Screen canvas={canvasReady} dirty={dirty} />}
        />
      </Canvas>

      {/*
        Vignette and grain.

        A render is uniformly sharp and uniformly clean to the very corners,
        which is the giveaway no amount of material work fixes. Falling off at
        the edges and carrying a little noise is what a photograph of this room
        would do, and it costs two divs.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 95% at 50% 44%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.16) 72%, rgba(0,0,0,0.44) 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay"
        style={{
          backgroundImage: GRAIN,
          backgroundSize: '160px 160px',
        }}
      />

      {/*
        Scrim behind the heading, and the band below for the controls.
      */}
      {/*
        A pale scrim now, and dark type over it.
        
        The surround is white, so the dark band that used to sit behind the
        heading became a grey stripe across the top of a light picture, with
        near-white text on it.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          background: 'linear-gradient(to bottom, rgba(248,247,244,0.85), rgba(248,247,244,0))',
        }}
      />

      {/* Overlay chrome. Only Free look hands the scene to the mouse. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-7">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-[#1b1d1f]">Runner</h1>
            <p className="mt-0.5 text-[12px] text-[#5d6367]">Runs with no connection</p>
          </div>
          <div className="mono flex items-baseline gap-4 text-[#1b1d1f]">
            <span className="text-[22px] tabular-nums">
              {String(score).padStart(5, '0')}
            </span>
            <span className="text-[12px] text-[#5d6367]">
              best {String(best).padStart(5, '0')}
            </span>
          </div>
        </div>

        {/*
          One black band under all the controls, edge to edge.

          Individually darkened pills were still landing on whatever happened to
          be behind them — over the sticky pad and the sketchbook they dropped to
          almost nothing. A single bar gives every control the same background
          whatever the camera is looking at, and a short fade above it keeps the
          top edge off the picture.
        */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-full h-16"
            style={{
              background: 'linear-gradient(to top, rgba(6,7,9,0.92), rgba(6,7,9,0))',
            }}
          />
          <div className="flex flex-wrap items-end justify-between gap-4 bg-[rgba(6,7,9,0.92)] px-5 py-4 sm:px-7">
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            {VIEWS.map((v, i) => (
              <button
                key={v.id}
                onClick={() => {
                  setFree(false);
                  setView(i);
                }}
                aria-pressed={!free && view === i}
                className={`min-h-[38px] rounded-full px-4 text-[13px] transition-colors ${
                  !free && view === i
                    ? 'bg-[#f4f8f9] font-semibold text-[#0a0d0f] ring-1 ring-white/60'
                    : 'bg-white/12 text-[#e9f0f2] ring-1 ring-white/15 hover:bg-white/22'
                }`}
              >
                {v.label}
              </button>
            ))}
            <button
              onClick={() => setFree(true)}
              aria-pressed={free}
              title="Drag to orbit, scroll to zoom"
              className={`min-h-[38px] rounded-full px-4 text-[13px] transition-colors ${
                free
                  ? 'bg-[#f4f8f9] font-semibold text-[#0a0d0f] ring-1 ring-white/60'
                  : 'bg-white/12 text-[#e9f0f2] ring-1 ring-white/15 hover:bg-white/22'
              }`}
            >
              Free look
            </button>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-[12px] text-[#aab4b8]">{hint}</p>
            <div className="pointer-events-auto flex gap-1.5">
              {phase === 'dead' && (
                <button
                  onClick={restart}
                  className="min-h-[38px] rounded-full bg-[#f4f8f9] px-4 text-[13px] font-semibold text-[#0a0d0f] ring-1 ring-white/60"
                >
                  Run again
                </button>
              )}
              {canInstall && (
                <button
                  onClick={install}
                  className="min-h-[38px] rounded-full bg-white/12 px-4 text-[13px] text-[#e9f0f2] ring-1 ring-white/15 transition-colors hover:bg-white/22"
                >
                  Install
                </button>
              )}
              <button
                onClick={toggleSound}
                className="min-h-[38px] rounded-full bg-white/12 px-4 text-[13px] text-[#e9f0f2] ring-1 ring-white/15 transition-colors hover:bg-white/22"
              >
                {muted ? 'Sound off' : 'Sound on'}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { isMuted };
