'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { indexToSquare, squareToIndex } from '@/lib/chess/types';
import { BOARD_TOP, squareToWorld } from './coords';
import { BOARD_SPAN, FRAME, TOTAL, createBoardRoughness, createBoardTexture } from './boardTexture';

interface Props {
  onSquareClick: (square: number) => void;
  selected: number | null;
  targets: Array<{ square: number; capture: boolean }>;
  lastMove: { from: number; to: number } | null;
  checkSquare: number | null;
  showLegal: boolean;
}

const HIGHLIGHT_Y = BOARD_TOP + 0.004;

export default function Board({
  onSquareClick,
  selected,
  targets,
  lastMove,
  checkSquare,
  showLegal,
}: Props) {
  const map = useMemo(() => createBoardTexture(), []);
  const roughnessMap = useMemo(() => createBoardRoughness(), []);

  const squares = useMemo(
    () => Array.from({ length: 64 }, (_, i) => indexToSquare(i)),
    [],
  );

  return (
    <group>
      {/* Playing surface + frame, one textured slab. */}
      <mesh receiveShadow position={[0, BOARD_TOP - 0.12, 0]}>
        <boxGeometry args={[TOTAL, 0.24, TOTAL]} />
        <meshPhysicalMaterial
          map={map}
          roughnessMap={roughnessMap}
          roughness={1}
          metalness={0}
          clearcoat={0.3}
          clearcoatRoughness={0.42}
        />
      </mesh>

      {/* Plinth: a darker slab that reads as the underside of a heavy board. */}
      <mesh position={[0, BOARD_TOP - 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[TOTAL - 0.14, 0.14, TOTAL - 0.14]} />
        <meshStandardMaterial color="#1b1310" roughness={0.85} />
      </mesh>

      {/* Invisible pick targets, one per square. */}
      {squares.map((sq) => {
        const [x, , z] = squareToWorld(sq);
        return (
          <mesh
            key={`hit-${sq}`}
            position={[x, BOARD_TOP + 0.001, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSquareClick(sq);
            }}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        );
      })}

      {lastMove && (
        <>
          <SquareTint square={lastMove.from} color="#f0c674" opacity={0.16} />
          <SquareTint square={lastMove.to} color="#f0c674" opacity={0.26} />
        </>
      )}

      {selected !== null && <SelectionRing square={selected} />}

      {showLegal &&
        targets.map((t) =>
          t.capture ? (
            <CaptureRing
              key={`cap-${t.square}`}
              square={t.square}
              onClick={() => onSquareClick(t.square)}
            />
          ) : (
            <MoveDot
              key={`dot-${t.square}`}
              square={t.square}
              onClick={() => onSquareClick(t.square)}
            />
          ),
        )}

      {checkSquare !== null && <CheckGlow square={checkSquare} />}
    </group>
  );
}

function SquareTint({
  square,
  color,
  opacity,
}: {
  square: number;
  color: string;
  opacity: number;
}) {
  const [x, , z] = squareToWorld(square);
  return (
    <mesh position={[x, HIGHLIGHT_Y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function SelectionRing({ square }: { square: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const [x, , z] = squareToWorld(square);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 3.4) * 0.03;
    ref.current.scale.set(s, s, 1);
  });
  return (
    <mesh ref={ref} position={[x, HIGHLIGHT_Y + 0.002, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.475, 48]} />
      <meshBasicMaterial color="#7fe3b0" transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

function MoveDot({ square, onClick }: { square: number; onClick: () => void }) {
  const [x, , z] = squareToWorld(square);
  return (
    <group position={[x, HIGHLIGHT_Y + 0.001, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.145, 28]} />
        <meshBasicMaterial color="#7fe3b0" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* Raised, invisible catcher so the marker is reachable over a piece. */}
      <mesh
        position={[0, 0.34, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[0.3, 12, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

function CaptureRing({ square, onClick }: { square: number; onClick: () => void }) {
  const [x, , z] = squareToWorld(square);
  return (
    <group position={[x, HIGHLIGHT_Y + 0.001, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.39, 0.48, 40]} />
        <meshBasicMaterial color="#ff7a5c" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh
        position={[0, 0.5, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <cylinderGeometry args={[0.42, 0.42, 1, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

function CheckGlow({ square }: { square: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  const [x, , z] = squareToWorld(square);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.opacity = 0.32 + Math.sin(clock.getElapsedTime() * 5) * 0.18;
    }
  });
  return (
    <mesh position={[x, HIGHLIGHT_Y + 0.0005, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.5, 36]} />
      <meshBasicMaterial ref={ref} color="#ff3b30" transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

export { squareToIndex };
