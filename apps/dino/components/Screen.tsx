'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SCREEN_H, SCREEN_W } from '@/lib/game/screen';
import { bulgedPlane, SCREEN_SIZE } from './Machine';

/**
 * The picture, and the glass over it.
 *
 * The game canvas becomes a texture with nearest-neighbour filtering and no
 * mipmaps: magnified onto the tube, that keeps the pixels square and hard. The
 * default linear filter would smear them into mush, which is the one thing a
 * pixel game cannot survive.
 */
export default function Screen({
  canvas,
  dirty,
}: {
  canvas: HTMLCanvasElement | null;
  /** Bumped by the game loop each time the canvas is redrawn. */
  dirty: React.MutableRefObject<number>;
}) {
  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);

  useEffect(() => () => texture?.dispose(), [texture]);

  const seen = useRef(-1);
  useFrame(() => {
    if (!texture) return;
    if (seen.current === dirty.current) return;
    seen.current = dirty.current;
    texture.needsUpdate = true;
  });

  const picture = useMemo(
    () => bulgedPlane(SCREEN_SIZE.w, SCREEN_SIZE.h, 0.055),
    [],
  );
  const glass = useMemo(
    () => bulgedPlane(SCREEN_SIZE.w + 0.02, SCREEN_SIZE.h + 0.02, 0.062),
    [],
  );

  return (
    <group position={[0, 0, 0.05]}>
      {/* The picture is self-lit, so it ignores the room lights entirely. */}
      <mesh geometry={picture}>
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#f7f7f7" />
        )}
      </mesh>

      {/* Glass: a faint sheen and a single specular streak across the top left. */}
      <mesh geometry={glass} position={[0, 0, 0.012]}>
        <meshPhysicalMaterial
          transparent
          opacity={0.16}
          roughness={0.08}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.04}
          color="#dfe6e8"
        />
      </mesh>

      {/*
        The screen throws light into the room. Without this the tube reads as a
        printed sticker rather than something that is switched on.
      */}
      <pointLight position={[0, 0.1, 0.9]} intensity={1.1} distance={3.4} color="#eaf2ff" />
      <pointLight position={[0, -0.6, 1.6]} intensity={0.5} distance={4} color="#dce8ff" />
    </group>
  );
}

export { SCREEN_W, SCREEN_H };
