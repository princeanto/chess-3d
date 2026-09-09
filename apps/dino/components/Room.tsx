'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { frustumY, roundedShape } from './Machine';

/**
 * The room the machine sits in: a warm desk under a washed wall.
 *
 * Two rules run through all of it. The mood is painted into canvases rather
 * than lit — the wall's wash, the pool on the desk, the grain in the wood —
 * because a real light would slide across all three as the camera moves between
 * framed viewpoints, and the point of those viewpoints is that they are
 * composed. And nothing is a flat colour on a hard-edged box: every surface
 * gets a mottled roughness map so its sheen varies, and every object gets a
 * radius on its edges. Uniform roughness on a sharp box is most of what makes a
 * render look like a render.
 */

const DESK = { w: 8.4, d: 7.4, cz: 0.25, thickness: 0.14 };
const WALL_Z = -3.62;

/* ------------------------------- materials ------------------------------- */

/**
 * Soft mottling, for use as a roughness map.
 *
 * Blobs rather than per-pixel noise: pixel noise is far too high a frequency to
 * survive mipmapping and just turns to grey at any distance. Keep `strength`
 * low — pushed hard it stops reading as a surface and starts reading as a
 * stain, which had the felt mat looking mouldy and the wall looking damp.
 */
function mottle(size = 256, strength = 0.25, blobs = 900): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < blobs; i += 1) {
    const light = Math.random() < 0.5;
    const a = Math.random() * 0.09 * strength;
    ctx.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * size,
      Math.random() * size,
      2 + Math.random() * (size / 12),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function useWood(): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#9c7b52';
    ctx.fillRect(0, 0, 1024, 1024);

    // Grain: long wandering lines, each a shallow sine with its own phase, so
    // it does not read as corduroy. Fine and low contrast; oak at this distance
    // is mostly tone, not stripes.
    for (let i = 0; i < 520; i += 1) {
      const y = Math.random() * 1024;
      const amp = 3 + Math.random() * 14;
      const phase = Math.random() * Math.PI * 2;
      const dark = Math.random() < 0.45;
      ctx.strokeStyle = dark
        ? `rgba(92, 62, 32, ${0.04 + Math.random() * 0.13})`
        : `rgba(206, 172, 128, ${0.03 + Math.random() * 0.1})`;
      ctx.lineWidth = 0.5 + Math.random() * 1.9;
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 14) {
        const yy = y + Math.sin(x / 280 + phase) * amp + Math.sin(x / 57 + phase) * 1.4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Board seams. A single slab of timber this wide would not exist.
    for (const y of [212, 468, 726, 946]) {
      ctx.strokeStyle = 'rgba(58, 36, 16, 0.4)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(226, 196, 152, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      ctx.lineTo(1024, y + 2);
      ctx.stroke();
    }

    // Open pores, so it is not glass-smooth at close range.
    for (let i = 0; i < 2600; i += 1) {
      ctx.fillStyle = `rgba(64, 42, 20, ${0.03 + Math.random() * 0.09})`;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * 1024,
        Math.random() * 1024,
        0.6 + Math.random() * 3.4,
        0.4 + Math.random() * 0.9,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // The lamps' pool, baked so it stays where it is framed.
    const pool = ctx.createRadialGradient(512, 330, 40, 512, 470, 640);
    pool.addColorStop(0, 'rgba(255, 228, 188, 0.26)');
    pool.addColorStop(0.45, 'rgba(186, 146, 100, 0.08)');
    pool.addColorStop(1, 'rgba(18, 12, 6, 0.68)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, 1024, 1024);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const rough = mottle(512, 0.45, 1600);
    rough.repeat.set(2, 2);
    return { map, rough };
  }, []);
}

function useWall(): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#181109';
    ctx.fillRect(0, 0, 1024, 1024);
    // Two overlapping washes from the lamps, brightest a little above the desk.
    for (const cx of [318, 706]) {
      const g = ctx.createRadialGradient(cx, 700, 20, cx, 660, 560);
      g.addColorStop(0, 'rgba(246, 229, 202, 0.9)');
      g.addColorStop(0.4, 'rgba(194, 162, 124, 0.38)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    // Paint has tooth. Without it the wall is a perfect gradient, which is the
    // single most render-looking thing in the room.
    for (let i = 0; i < 5000; i += 1) {
      const light = Math.random() < 0.5;
      ctx.fillStyle = light
        ? `rgba(255,255,255,${Math.random() * 0.035})`
        : `rgba(0,0,0,${Math.random() * 0.045})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 1024, 0.5 + Math.random() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const rough = mottle(512, 0.16, 1400);
    rough.repeat.set(3, 3);
    return { map, rough };
  }, []);
}

/* -------------------------------- helpers -------------------------------- */

/** A box with its edges taken off, standing in XY and extruded along Z. */
function roundedBox(w: number, h: number, d: number, r: number, bevel = 0.02) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/* --------------------------------- desk ---------------------------------- */

function deskTop(): THREE.BufferGeometry {
  const bevel = 0.035;
  const g = new THREE.ExtrudeGeometry(roundedShape(DESK.w, DESK.d, 0.3), {
    depth: DESK.thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 22,
  });
  g.rotateX(-Math.PI / 2);
  // Sit the top face on zero, where everything else already stands.
  g.translate(0, -(DESK.thickness + bevel), DESK.cz);

  /*
   * Planar UVs, projected straight down. ExtrudeGeometry derives its own from
   * the shape's coordinates, which would lay the grain on edge-on.
   */
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.attributes.position;
  const uv: number[] = [];
  for (let i = 0; i < pos.count; i += 1) {
    uv.push(
      (pos.getX(i) - min.x) / (max.x - min.x),
      (pos.getZ(i) - min.z) / (max.z - min.z),
    );
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/* --------------------------------- props --------------------------------- */

/** Linen, lit from inside: brighter low where the bulb sits, cooler at the rim. */
function useShade(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#ffdca8');
    g.addColorStop(0.45, '#fff0d2');
    g.addColorStop(1, '#ffd79c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
    // A slack weave, so the shade is fabric and not a paper tube.
    for (let i = 0; i < 240; i += 1) {
      ctx.strokeStyle = `rgba(150, 110, 66, ${0.02 + Math.random() * 0.05})`;
      ctx.lineWidth = 0.6 + Math.random();
      const horizontal = Math.random() < 0.5;
      ctx.beginPath();
      if (horizontal) {
        const y = Math.random() * 256;
        ctx.moveTo(0, y);
        ctx.lineTo(128, y);
      } else {
        const x = Math.random() * 128;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
      }
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Lamp({ x, z, rough }: { x: number; z: number; rough: THREE.Texture }) {
  const shade = useShade();
  return (
    <group position={[x, 0, z]}>
      {/* Three splayed legs and a collar, the way these little stands are made. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.12, 0.19, Math.sin(a) * 0.12]}
            rotation={[Math.sin(a) * 0.24, 0, -Math.cos(a) * 0.24]}
            castShadow
          >
            <cylinderGeometry args={[0.021, 0.026, 0.4, 12]} />
            <meshStandardMaterial color="#9c6f3e" roughness={0.72} roughnessMap={rough} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.36, 0]}>
        <torusGeometry args={[0.12, 0.017, 10, 28]} />
        <meshStandardMaterial color="#9c6f3e" roughness={0.7} />
      </mesh>

      <mesh position={[0, 0.63, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.185, 0.44, 40, 1, true]} />
        <meshStandardMaterial
          map={shade}
          emissive="#ffffff"
          emissiveMap={shade}
          emissiveIntensity={1.25}
          roughness={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.849, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.199, 32]} />
        <meshStandardMaterial color="#fff2da" emissive="#ffcf96" emissiveIntensity={0.85} />
      </mesh>

      <pointLight position={[0, 0.6, 0]} intensity={5.2} distance={7} decay={2} color="#ffb870" />
    </group>
  );
}

/** A bookshelf speaker: rounded cabinet, recessed baffle, two drivers. */
function Speaker({
  x,
  z,
  flip,
  rough,
}: {
  x: number;
  z: number;
  flip: number;
  rough: THREE.Texture;
}) {
  const cabinet = useMemo(() => roundedBox(0.66, 1.04, 0.72, 0.05, 0.022), []);
  const baffle = useMemo(() => roundedBox(0.6, 0.98, 0.02, 0.04, 0.008), []);
  return (
    <group position={[x, 0, z]} rotation={[0, flip * 0.16, 0]}>
      <mesh geometry={cabinet} position={[0, 0.52, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e4e0d8" roughness={0.66} roughnessMap={rough} />
      </mesh>
      <mesh geometry={baffle} position={[0, 0.52, 0.362]}>
        <meshStandardMaterial color="#dcd7ce" roughness={0.72} roughnessMap={rough} />
      </mesh>

      {/*
        Woofer: a solid cone face, a surround at its rim, a dust cap in the
        middle. An open-ended cylinder for the cone left nothing between the
        surround and the cap, and the pair read as a ring around a planet.
      */}
      {/*
        Flat discs, not a cone with a dust cap in it.
        
        Two attempts at real cone geometry both came out as a ring with a bead
        floating in it — the cap kept punching through the cone's narrow end and
        the baffle sat in the middle of both. At this distance a driver is a dark
        disc with a rim, and that is all it needs to be.
      */}
      <mesh position={[0, 0.36, 0.374]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.175, 0.175, 0.012, 40]} />
        <meshStandardMaterial color="#17181b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.36, 0.378]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.172, 0.015, 10, 36]} />
        <meshStandardMaterial color="#2a2a30" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.36, 0.382]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.008, 24]} />
        <meshStandardMaterial color="#33333b" roughness={0.42} />
      </mesh>

      {/* Tweeter, the same idea a size down. */}
      <mesh position={[0, 0.79, 0.374]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.086, 0.086, 0.012, 30]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.79, 0.379]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.044, 0.044, 0.01, 22]} />
        <meshStandardMaterial color="#3a3a44" roughness={0.32} metalness={0.35} />
      </mesh>
    </group>
  );
}

function Clock({ rough }: { rough: THREE.Texture }) {
  const body = useMemo(() => roundedBox(0.38, 0.26, 0.16, 0.035, 0.012), []);
  return (
    <group position={[-1.72, 0, 0.62]} rotation={[0, 0.14, 0]}>
      <mesh geometry={body} position={[0, 0.13, 0]} castShadow>
        <meshStandardMaterial color="#26262a" roughness={0.68} roughnessMap={rough} />
      </mesh>
      <mesh position={[0, 0.145, 0.082]}>
        <planeGeometry args={[0.26, 0.12]} />
        <meshStandardMaterial
          color="#0e1416"
          emissive="#7fd8c4"
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** Felt mat, with the overlocked edge these always have. */
function DeskMat() {
  const felt = useMemo(() => mottle(512, 0.22, 2600), []);
  const pad = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedShape(6.2, 2.15, 0.1), {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group position={[0.15, 0.004, 1.42]}>
      <mesh geometry={pad} receiveShadow>
        <meshStandardMaterial color="#33322f" roughness={0.99} roughnessMap={felt} />
      </mesh>
    </group>
  );
}

/* ------------------------------ desk things ------------------------------ */

/**
 * The things a product designer actually has out.
 *
 * Placed around the mat and clear of the lamps and speakers rather than
 * scattered: a desk reads as used when the objects sit where a hand would leave
 * them, and as dressed when they are spaced evenly.
 */

/** Pens, pencils and a marker in a cup, each at its own angle. */
function PenCup({ rough }: { rough: THREE.Texture }) {
  const pens = useMemo(() => {
    const rng = (n: number) => (((Math.sin(n * 91.7) * 43758.5453) % 1) + 1) % 1;
    const kinds = [
      { colour: '#2b2b30', r: 0.017, len: 0.86 },
      { colour: '#c9a227', r: 0.016, len: 0.8 },
      { colour: '#b8443c', r: 0.018, len: 0.74 },
      { colour: '#2f4f5c', r: 0.017, len: 0.9 },
      { colour: '#d8d3c6', r: 0.02, len: 0.7 },
      { colour: '#3c3a38', r: 0.015, len: 0.82 },
    ];
    return kinds.map((k, i) => ({
      ...k,
      lean: 0.06 + rng(i) * 0.2,
      spin: rng(i + 9) * Math.PI * 2,
      off: [(rng(i + 3) - 0.5) * 0.11, (rng(i + 6) - 0.5) * 0.11] as [number, number],
    }));
  }, []);

  return (
    <group position={[-2.35, 0, 0.05]}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.145, 0.48, 28, 1, true]} />
        <meshStandardMaterial
          color="#8f8b82"
          roughness={0.7}
          roughnessMap={rough}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.145, 24]} />
        <meshStandardMaterial color="#6f6b63" roughness={0.8} />
      </mesh>
      {pens.map((pen, i) => (
        <group key={i} rotation={[0, pen.spin, 0]}>
          <mesh
            position={[pen.off[0], 0.1 + pen.len / 2, pen.off[1]]}
            rotation={[pen.lean, 0, pen.lean * 0.6]}
            castShadow
          >
            <cylinderGeometry args={[pen.r, pen.r, pen.len, 12]} />
            <meshStandardMaterial color={pen.colour} roughness={0.5} roughnessMap={rough} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A hardback sketchbook with its elastic closure, and a pen resting on it. */
function Sketchbook({ rough }: { rough: THREE.Texture }) {
  const cover = useMemo(() => roundedBox(1.15, 1.5, 0.11, 0.05, 0.014), []);
  return (
    <group position={[-3.28, 0, 1.75]} rotation={[0, 0.19, 0]}>
      <mesh geometry={cover} position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#33312e" roughness={0.78} roughnessMap={rough} />
      </mesh>
      {/* The page block, showing as a pale edge under the cover. */}
      <mesh position={[0, 0.032, 0]}>
        <boxGeometry args={[1.11, 0.05, 1.46]} />
        <meshStandardMaterial color="#ddd6c4" roughness={0.9} />
      </mesh>
      {/* Elastic band across the fore-edge. */}
      <mesh position={[0.42, 0.058, 0]}>
        <boxGeometry args={[0.05, 0.115, 1.54]} />
        <meshStandardMaterial color="#1e1d1b" roughness={0.7} />
      </mesh>
      <mesh position={[-0.05, 0.128, -0.16]} rotation={[0, 0.36, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.021, 0.021, 0.92, 14]} />
        <meshStandardMaterial color="#26262a" roughness={0.45} />
      </mesh>
    </group>
  );
}

/** A colour fan, opened out — the one object that says product designer. */
function ColourFan() {
  const chips = useMemo(() => {
    const hues = [
      '#c9503f', '#d97b34', '#e0b23c', '#8ea64a', '#3f8f6d',
      '#3d7f9c', '#3b5b96', '#6b4b96', '#a8467e', '#8c5a3c',
      '#c9c2b4', '#3a3a3e',
    ];
    return hues.map((colour, i) => ({ colour, angle: -0.5 + i * 0.115 }));
  }, []);
  return (
    <group position={[2.92, 0, 0.2]} rotation={[0, -0.5, 0]}>
      {chips.map((c, i) => (
        // Each chip pivots about the rivet at one end, so they fan rather than
        // stack — the swing is what makes the object readable from above.
        <group key={i} rotation={[0, c.angle, 0]}>
          <mesh position={[0, 0.012 + i * 0.004, 0.34]} castShadow>
            <boxGeometry args={[0.14, 0.006, 0.7]} />
            <meshStandardMaterial color={c.colour} roughness={0.72} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.09, 12]} />
        <meshStandardMaterial color="#8d8a84" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

function Mug({ rough }: { rough: THREE.Texture }) {
  return (
    <group position={[3.5, 0, 1.15]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.185, 0.52, 30, 1, true]} />
        <meshStandardMaterial
          color="#e8e4dc"
          roughness={0.42}
          roughnessMap={rough}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.185, 24]} />
        <meshStandardMaterial color="#d8d4cc" roughness={0.5} />
      </mesh>
      {/* Coffee, a little below the rim. */}
      <mesh position={[0, 0.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.208, 26]} />
        <meshStandardMaterial color="#3a2317" roughness={0.28} />
      </mesh>
      <mesh position={[0.24, 0.29, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.115, 0.028, 10, 22, Math.PI * 1.25]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.42} />
      </mesh>
    </group>
  );
}

/** A pad of sticky notes with the top sheet curling, and a triangular scale. */
function PaperAndScale({ rough }: { rough: THREE.Texture }) {
  return (
    <group>
      <group position={[-2.5, 0, 2.98]} rotation={[0, -0.22, 0]}>
        <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.07, 0.62]} />
          <meshStandardMaterial color="#e8d477" roughness={0.92} roughnessMap={rough} />
        </mesh>
        <mesh position={[0.01, 0.073, 0.015]} rotation={[0, 0.07, 0]}>
          <boxGeometry args={[0.6, 0.006, 0.6]} />
          <meshStandardMaterial color="#f2e394" roughness={0.94} />
        </mesh>
      </group>

      {/* Triangular scale rule: a three-sided prism is exactly a 3-segment cylinder. */}
      <mesh
        position={[2.75, 0.06, 2.62]}
        rotation={[0, 0.34, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.07, 0.07, 1.7, 3]} />
        <meshStandardMaterial color="#dcd8ce" roughness={0.42} roughnessMap={rough} />
      </mesh>
    </group>
  );
}

/* ------------------------------ shelf, plant ----------------------------- */

const SHELF_Y = [3.9, 5.22];

function Shelves({ rough }: { rough: THREE.Texture }) {
  const books = useMemo(() => {
    const rng = (n: number) => (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1;
    const colours = ['#7a4c37', '#33484f', '#867049', '#3d3a44', '#67413c', '#4b5740'];
    let cursor = 0.6;
    return Array.from({ length: 11 }, (_, i) => {
      const w = 0.09 + rng(i) * 0.1;
      const h = 0.52 + rng(i + 40) * 0.3;
      const x = cursor + w / 2;
      cursor += w + 0.012;
      return { x, w, h, colour: colours[i % colours.length], lean: rng(i + 80) * 0.06 };
    });
  }, []);
  const plank = useMemo(() => roundedBox(7.4, 0.1, 0.56, 0.03, 0.012), []);

  return (
    <group>
      {SHELF_Y.map((y) => (
        <mesh key={y} geometry={plank} position={[0, y, WALL_Z + 0.3]} castShadow receiveShadow>
          <meshStandardMaterial color="#7d5730" roughness={0.76} roughnessMap={rough} />
        </mesh>
      ))}

      {books.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, SHELF_Y[1] + 0.05 + b.h / 2, WALL_Z + 0.3]}
          rotation={[0, 0, b.lean]}
          castShadow
        >
          <boxGeometry args={[b.w, b.h, 0.4]} />
          <meshStandardMaterial color={b.colour} roughness={0.86} roughnessMap={rough} />
        </mesh>
      ))}

      <mesh position={[2.45, SHELF_Y[1] + 0.53, WALL_Z + 0.22]} rotation={[0.07, 0, 0]} castShadow>
        <boxGeometry args={[0.94, 0.86, 0.04]} />
        <meshStandardMaterial color="#e6dccb" roughness={0.78} roughnessMap={rough} />
      </mesh>

      <Plant rough={rough} />
    </group>
  );
}

/**
 * The pothos trailing off the top shelf.
 *
 * Real leaf shapes on visible stems. They started as flattened spheres strung
 * along a curve, which at any distance read as a string of green beads.
 */
function Plant({ rough }: { rough: THREE.Texture }) {
  const leaf = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.3, 0.34, 0.72, 0.3, 1, 0);
    shape.bezierCurveTo(0.72, -0.3, 0.3, -0.34, 0, 0);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.computeVertexNormals();
    return g;
  }, []);

  const strands = useMemo(() => {
    const rng = (n: number) => (((Math.sin(n * 78.233) * 43758.5453) % 1) + 1) % 1;
    const curves = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.5, SHELF_Y[1] + 0.02, WALL_Z + 0.42),
        new THREE.Vector3(-1.36, 4.75, WALL_Z + 0.6),
        new THREE.Vector3(-1.46, 4.15, WALL_Z + 0.5),
        new THREE.Vector3(-1.26, 3.5, WALL_Z + 0.64),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.02, SHELF_Y[1] + 0.02, WALL_Z + 0.4),
        new THREE.Vector3(-0.88, 4.6, WALL_Z + 0.58),
        new THREE.Vector3(-1.0, 3.95, WALL_Z + 0.44),
        new THREE.Vector3(-0.84, 3.25, WALL_Z + 0.6),
      ]),
    ];
    return curves.map((curve, si) => ({
      tube: new THREE.TubeGeometry(curve, 40, 0.012, 6, false),
      leaves: Array.from({ length: 11 }, (_, i) => {
        const t = 0.06 + (i / 11) * 0.94;
        return {
          p: curve.getPoint(t),
          s: 0.15 + rng(i + si * 20) * 0.07,
          rot: [
            rng(i + si * 7) * 1.2 - 0.6,
            rng(i + si * 11) * Math.PI * 2,
            rng(i + si * 13) * 1.4 - 0.7,
          ] as [number, number, number],
          dark: (i + si) % 3 === 0,
        };
      }),
    }));
  }, []);

  return (
    <group>
      <mesh position={[-1.28, SHELF_Y[1] + 0.23, WALL_Z + 0.3]} castShadow>
        <cylinderGeometry args={[0.26, 0.21, 0.36, 24]} />
        <meshStandardMaterial color="#ddd8ce" roughness={0.82} roughnessMap={rough} />
      </mesh>
      {strands.map((s, si) => (
        <group key={si}>
          <mesh geometry={s.tube}>
            <meshStandardMaterial color="#4a6b3c" roughness={0.85} />
          </mesh>
          {s.leaves.map((l, i) => (
            <mesh key={i} geometry={leaf} position={l.p} rotation={l.rot} scale={l.s} castShadow>
              <meshStandardMaterial
                color={l.dark ? '#2f5230' : '#3d6b39'}
                roughness={0.62}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* --------------------------------- room ---------------------------------- */

export default function Room() {
  const wood = useWood();
  const wall = useWall();
  const props = useMemo(() => mottle(256, 0.35, 1100), []);
  const top = useMemo(() => deskTop(), []);
  const leg = useMemo(() => frustumY(0.19, 0.19, 0.13, 0.13, 2.7), []);
  const legX = DESK.w / 2 - 0.62;
  const legZ = DESK.d / 2 - 0.62;

  return (
    <group>
      <mesh position={[0, 2.6, WALL_Z]} receiveShadow>
        <planeGeometry args={[24, 13]} />
        <meshStandardMaterial map={wall.map} roughnessMap={wall.rough} roughness={0.96} />
      </mesh>

      <mesh geometry={top} receiveShadow castShadow>
        <meshStandardMaterial
          map={wood.map}
          roughnessMap={wood.rough}
          roughness={0.58}
          metalness={0.02}
        />
      </mesh>

      {[
        [-legX, DESK.cz - legZ],
        [legX, DESK.cz - legZ],
        [-legX, DESK.cz + legZ],
        [legX, DESK.cz + legZ],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} geometry={leg} position={[x, -2.87, z]} castShadow>
          <meshStandardMaterial color="#54391f" roughness={0.78} roughnessMap={props} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.88, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#161009" roughness={0.94} />
      </mesh>

      <DeskMat />
      <Lamp x={-2.55} z={-0.95} rough={props} />
      <Lamp x={2.55} z={-0.95} rough={props} />
      <Speaker x={-3.45} z={-1.1} flip={1} rough={props} />
      <Speaker x={3.45} z={-1.1} flip={-1} rough={props} />
      <Clock rough={props} />
      <PenCup rough={props} />
      <Sketchbook rough={props} />
      <ColourFan />
      <Mug rough={props} />
      <PaperAndScale rough={props} />
      <Shelves rough={props} />
    </group>
  );
}
