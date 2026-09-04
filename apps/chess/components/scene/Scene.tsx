'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Position } from '@/lib/chess/types';
import Board from './Board';
import Pieces from './Pieces';

interface Props {
  position: Position;
  lastMove: { from: number; to: number } | null;
  selected: number | null;
  targets: Array<{ square: number; capture: boolean }>;
  checkSquare: number | null;
  flipped: boolean;
  showLegal: boolean;
  animate: boolean;
  onSquareClick: (square: number) => void;
}

export default function Scene(props: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 13.3, 11.2], fov: 34, near: 0.1, far: 120 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.background = new THREE.Color('#0c0d10');
        scene.fog = new THREE.Fog('#0c0d10', 26, 52);
      }}
    >
      <Rig flipped={props.flipped} />
      <FitBoard />
      <Lighting />
      <Table />
      <Board
        onSquareClick={props.onSquareClick}
        selected={props.selected}
        targets={props.targets}
        lastMove={props.lastMove}
        checkSquare={props.checkSquare}
        showLegal={props.showLegal}
      />
      <Pieces
        position={props.position}
        lastMove={props.lastMove}
        animate={props.animate}
        selected={props.selected}
        onPieceClick={props.onSquareClick}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={9}
        maxDistance={44}
        minPolarAngle={0.16}
        maxPolarAngle={Math.PI / 2 - 0.07}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0.3, 0]}
      />
    </Canvas>
  );
}

interface ControlsLike {
  getAzimuthalAngle: () => number;
  setAzimuthalAngle: (a: number) => void;
  update: () => void;
}

/**
 * Flipping the board rotates the camera around it rather than rotating the
 * board itself — the coordinates stay put, and the move reads as walking round
 * the table instead of the world spinning.
 */
function Rig({ flipped }: { flipped: boolean }) {
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const target = useRef<number | null>(null);
  const previous = useRef(flipped);

  useEffect(() => {
    if (previous.current === flipped) return;
    previous.current = flipped;
    target.current = flipped ? Math.PI : 0;
  }, [flipped]);

  useFrame((_, delta) => {
    if (target.current === null || !controls) return;
    const current = controls.getAzimuthalAngle();
    let diff = target.current - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.004) {
      controls.setAzimuthalAngle(target.current);
      target.current = null;
    } else {
      controls.setAzimuthalAngle(current + diff * Math.min(1, delta * 6));
    }
    controls.update();
  });

  return null;
}

/**
 * Dollies the camera so the whole board fits whatever shape the viewport is.
 * The default distance frames a landscape panel; on a phone held upright the
 * horizontal field of view is far narrower and the a- and h-files fall outside
 * it. Runs on mount and on resize only, so a manual zoom is left alone.
 */
function FitBoard() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    if (!persp.isPerspectiveCamera) return;

    const span = 9.9; // board plus a little breathing room
    const vFov = (persp.fov * Math.PI) / 180;
    const fitHeight = span / 2 / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * persp.aspect);
    const fitWidth = span / 2 / Math.tan(hFov / 2);
    const distance = Math.max(fitHeight, fitWidth);

    const target = new THREE.Vector3(0, 0.3, 0);
    const direction = persp.position.clone().sub(target);
    if (direction.lengthSq() < 1e-6) return;
    persp.position.copy(target).addScaledVector(direction.normalize(), distance);
    persp.updateProjectionMatrix();
    controls?.update();
  }, [camera, size.width, size.height, controls]);

  return null;
}

function Lighting() {
  const key = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const light = key.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -8;
    cam.right = 8;
    cam.top = 8;
    cam.bottom = -8;
    cam.near = 1;
    cam.far = 34;
    cam.updateProjectionMatrix();
  }, []);

  return (
    <>
      <ambientLight intensity={0.42} color="#cfd6e4" />
      <hemisphereLight args={['#dfe6f2', '#20160f', 0.5]} />
      <directionalLight
        ref={key}
        castShadow
        position={[6.5, 13, 7]}
        intensity={2.5}
        color="#fff3dd"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      {/* Cool fill from the opposite side keeps the dark pieces from going flat. */}
      <directionalLight position={[-8, 6, -6]} intensity={0.65} color="#9fc0ff" />
      {/* Low rim light picks out the silhouettes against the background. */}
      <spotLight
        position={[0, 4.5, -11]}
        angle={0.75}
        penumbra={1}
        intensity={26}
        distance={30}
        color="#ffd9a8"
      />
    </>
  );
}

/** The surface the board sits on: a dark felt disc that catches its shadow. */
function Table() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#23262c');
    g.addColorStop(0.55, '#16181d');
    g.addColorStop(1, '#0b0c0f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // Fine speckle so the plane is not a flat gradient under raking light.
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 9;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow>
      <circleGeometry args={[19, 64]} />
      <meshStandardMaterial map={texture} roughness={0.94} metalness={0} />
    </mesh>
  );
}
