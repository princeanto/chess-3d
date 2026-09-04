'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  KING,
  KNIGHT,
  WHITE,
  fileOf,
  pieceColor,
  pieceType,
  type Position,
} from '@/lib/chess/types';
import { BOARD_TOP, squareToWorld } from './coords';
import { getPieceParts } from './pieceGeometry';

interface Props {
  position: Position;
  lastMove: { from: number; to: number } | null;
  animate: boolean;
  onPieceClick: (square: number) => void;
  selected: number | null;
}

const MOVE_MS = 300;

interface Slide {
  square: number; // destination
  from: THREE.Vector3;
  to: THREE.Vector3;
  arc: number;
  start: number;
}

interface Ghost {
  id: string;
  piece: number;
  world: THREE.Vector3;
  start: number;
}

export default function Pieces({ position, lastMove, animate, onPieceClick, selected }: Props) {
  const materials = useMemo(
    () => ({
      white: new THREE.MeshPhysicalMaterial({
        color: '#DED0B0',
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.42,
        clearcoatRoughness: 0.3,
        sheen: 0.3,
        sheenColor: new THREE.Color('#fff3d8'),
      }),
      black: new THREE.MeshPhysicalMaterial({
        color: '#2B2F37',
        roughness: 0.3,
        metalness: 0.14,
        clearcoat: 0.72,
        clearcoatRoughness: 0.18,
      }),
    }),
    [],
  );

  const slides = useRef<Slide[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const previous = useRef<Position | null>(null);

  // Diff against the previous position to decide what to animate. The store
  // hands us `lastMove`, but the rook of a castle and the captured piece have to
  // be inferred, which is exactly what the diff gives us.
  useEffect(() => {
    const prev = previous.current;
    previous.current = position;
    if (!prev || !lastMove || !animate) {
      slides.current = [];
      return;
    }

    const now = performance.now();
    const moving = position.board[lastMove.to];
    if (!moving) return;

    const list: Slide[] = [
      {
        square: lastMove.to,
        from: new THREE.Vector3(...squareToWorld(lastMove.from)),
        to: new THREE.Vector3(...squareToWorld(lastMove.to)),
        arc: pieceType(moving) === KNIGHT ? 0.75 : 0.16,
        start: now,
      },
    ];

    // Castling: the king moved two files, so the rook jumped the other way.
    if (pieceType(moving) === KING && Math.abs(fileOf(lastMove.to) - fileOf(lastMove.from)) === 2) {
      const kingside = fileOf(lastMove.to) > fileOf(lastMove.from);
      const rookFrom = kingside ? lastMove.to + 1 : lastMove.to - 2;
      const rookTo = kingside ? lastMove.to - 1 : lastMove.to + 1;
      list.push({
        square: rookTo,
        from: new THREE.Vector3(...squareToWorld(rookFrom)),
        to: new THREE.Vector3(...squareToWorld(rookTo)),
        arc: 0.1,
        start: now,
      });
    }
    slides.current = list;

    // Anything that vanished from a square it used to occupy was captured.
    const removed: Ghost[] = [];
    for (let sq = 0; sq < 128; sq += 1) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const before = prev.board[sq];
      const after = position.board[sq];
      if (before && before !== after && sq !== lastMove.from) {
        const stillThere = after && pieceColor(after) === pieceColor(before);
        if (!stillThere) {
          removed.push({
            id: `${sq}-${before}-${now}`,
            piece: before,
            world: new THREE.Vector3(...squareToWorld(sq)),
            start: now,
          });
        }
      }
    }
    if (removed.length) {
      setGhosts((g) => [...g, ...removed]);
      const ids = new Set(removed.map((r) => r.id));
      setTimeout(() => setGhosts((g) => g.filter((x) => !ids.has(x.id))), 480);
    }
  }, [position, lastMove, animate]);

  const occupied = useMemo(() => {
    const list: Array<{ square: number; piece: number }> = [];
    for (let sq = 0; sq < 128; sq += 1) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const piece = position.board[sq];
      if (piece) list.push({ square: sq, piece });
    }
    return list;
  }, [position]);

  return (
    <group>
      {occupied.map(({ square, piece }) => (
        <PieceMesh
          key={`${square}-${piece}`}
          square={square}
          piece={piece}
          material={pieceColor(piece) === WHITE ? materials.white : materials.black}
          slides={slides}
          selected={selected === square}
          onClick={() => onPieceClick(square)}
        />
      ))}
      {ghosts.map((g) => (
        <GhostMesh
          key={g.id}
          ghost={g}
          material={pieceColor(g.piece) === WHITE ? materials.white : materials.black}
        />
      ))}
    </group>
  );
}

function PieceMesh({
  square,
  piece,
  material,
  slides,
  selected,
  onClick,
}: {
  square: number;
  piece: number;
  material: THREE.Material;
  slides: React.MutableRefObject<Slide[]>;
  selected: boolean;
  onClick: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const parts = useMemo(() => getPieceParts(pieceType(piece)), [piece]);
  const color = pieceColor(piece);
  const home = useMemo(() => squareToWorld(square), [square]);
  const facing = pieceType(piece) === KNIGHT ? (color === WHITE ? Math.PI / 2 : -Math.PI / 2) : 0;
  const spawn = useRef(performance.now());

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const now = performance.now();
    const slide = slides.current.find((s) => s.square === square);

    if (slide) {
      const t = Math.min(1, (now - slide.start) / MOVE_MS);
      // easeInOutCubic keeps the piece from looking like it is being dragged.
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      g.position.lerpVectors(slide.from, slide.to, e);
      g.position.y = BOARD_TOP + Math.sin(Math.PI * t) * slide.arc;
      if (t >= 1) slides.current = slides.current.filter((s) => s !== slide);
      return;
    }

    // Promotion and setup pieces grow in rather than popping.
    const age = now - spawn.current;
    const s = age < 260 ? 0.4 + 0.6 * easeOutBack(age / 260) : 1;
    g.scale.setScalar(s);

    const lift = selected ? 0.14 : hovered ? 0.05 : 0;
    g.position.set(home[0], BOARD_TOP + lift, home[2]);
  });

  return (
    <group
      ref={group}
      position={[home[0], BOARD_TOP, home[2]]}
      rotation={[0, facing, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh geometry={parts.body} material={material} castShadow receiveShadow />
      {parts.details.map((d, i) => (
        <mesh
          key={i}
          geometry={d.geometry}
          material={material}
          position={d.position}
          rotation={d.rotation}
          castShadow
        />
      ))}
    </group>
  );
}

function GhostMesh({ ghost, material }: { ghost: Ghost; material: THREE.Material }) {
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => getPieceParts(pieceType(ghost.piece)), [ghost.piece]);
  const mat = useMemo(() => {
    const m = (material as THREE.MeshPhysicalMaterial).clone();
    m.transparent = true;
    return m;
  }, [material]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = Math.min(1, (performance.now() - ghost.start) / 420);
    g.position.set(ghost.world.x, BOARD_TOP - t * 0.5, ghost.world.z);
    g.scale.setScalar(1 - t * 0.35);
    g.rotation.y = t * 1.2;
    mat.opacity = 1 - t;
  });

  return (
    <group ref={group} position={ghost.world}>
      <mesh geometry={parts.body} material={mat} />
      {parts.details.map((d, i) => (
        <mesh key={i} geometry={d.geometry} material={mat} position={d.position} rotation={d.rotation} />
      ))}
    </group>
  );
}

const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
