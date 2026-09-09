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

/**
 * The room's shell, as a cutaway box.
 *
 * Only the two far walls exist, and both are single-sided planes facing inward.
 * That is what lets the isometric view look into the corner while every
 * ground-level viewpoint — several of which sit outside these bounds — carries
 * on seeing straight through them. A solid wall would black those shots out.
 */
const ROOM = { x0: -6.9, x1: 6.9, z0: WALL_Z, z1: 7.4, floorY: -2.88, wallTop: 6.2 };

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
  /*
   * Near-white, not mid-grey.
   *
   * A roughness map multiplies the material's own roughness, so a 50% grey
   * base halved it everywhere — a mat set to 0.99 was actually rendering at
   * 0.5 and picking up broad specular patches off the lamps. That is what had
   * looked like staining through several attempts at toning the map down: the
   * variation was never the problem, the base level was.
   */
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < blobs; i += 1) {
    const light = Math.random() < 0.5;
    const a = Math.random() * 0.085 * strength;
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
    pool.addColorStop(0, 'rgba(255, 230, 192, 0.24)');
    pool.addColorStop(0.45, 'rgba(190, 152, 106, 0.06)');
    pool.addColorStop(1, 'rgba(20, 14, 8, 0.4)');
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
    ctx.fillStyle = '#2b2015';
    ctx.fillRect(0, 0, 1024, 1024);
    /*
     * A broad wash over the whole wall first, then the two lamp pools on top.
     *
     * With only the pools the room went black a metre either side of the desk
     * and read as a lit table in a void rather than as a room.
     */
    const room = ctx.createLinearGradient(0, 1024, 0, 0);
    room.addColorStop(0, 'rgba(214, 178, 132, 0.82)');
    room.addColorStop(0.45, 'rgba(186, 152, 112, 0.6)');
    room.addColorStop(1, 'rgba(96, 72, 48, 0.28)');
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, 1024, 1024);
    for (const cx of [318, 706]) {
      const g = ctx.createRadialGradient(cx, 700, 20, cx, 660, 600);
      g.addColorStop(0, 'rgba(252, 238, 214, 0.88)');
      g.addColorStop(0.4, 'rgba(206, 176, 138, 0.4)');
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

/** The side wall: same paint, no lamp pools baked into it. */
function useSideWall(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#2b2015';
    ctx.fillRect(0, 0, 512, 512);
    const g = ctx.createLinearGradient(0, 512, 0, 0);
    g.addColorStop(0, 'rgba(216, 182, 138, 0.8)');
    g.addColorStop(0.5, 'rgba(190, 158, 118, 0.58)');
    g.addColorStop(1, 'rgba(104, 80, 54, 0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i += 1) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${
        Math.random() * 0.035
      })`;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 0.5 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
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
          emissiveIntensity={0.95}
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
        <meshStandardMaterial color="#e4e0d8" roughness={0.8} roughnessMap={rough} />
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
  const felt = useMemo(() => {
    const t = mottle(512, 0.22, 2600);
    // Tiled, not stretched: one copy across a mat this size makes each blob a
    // handspan wide, which reads as a stain rather than as a nap.
    t.repeat.set(7, 2.4);
    return t;
  }, []);
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

/* --------------------------------- shell --------------------------------- */

/** Pale boards, running front to back. */
function useFloorBoards(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#b9a храм'.slice(0, 7);
    ctx.fillStyle = '#b9a488';
    ctx.fillRect(0, 0, 1024, 1024);
    // Boards, with staggered end joints so it is laid rather than printed.
    const bw = 1024 / 9;
    for (let b = 0; b < 9; b += 1) {
      const shade = 0.9 + ((b * 37) % 20) / 100;
      ctx.fillStyle = `rgba(${Math.round(185 * shade)}, ${Math.round(164 * shade)}, ${Math.round(136 * shade)}, 1)`;
      ctx.fillRect(b * bw, 0, bw - 1.5, 1024);
      ctx.strokeStyle = 'rgba(74, 56, 36, 0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(b * bw, 0);
      ctx.lineTo(b * bw, 1024);
      ctx.stroke();
      let y = ((b * 211) % 400) - 200;
      while (y < 1024) {
        ctx.beginPath();
        ctx.moveTo(b * bw, y);
        ctx.lineTo(b * bw + bw - 1.5, y);
        ctx.stroke();
        y += 330 + ((b * 97) % 160);
      }
    }
    for (let i = 0; i < 900; i += 1) {
      ctx.strokeStyle = `rgba(96, 74, 48, ${0.02 + Math.random() * 0.07})`;
      ctx.lineWidth = 0.5 + Math.random();
      const x = Math.random() * 1024;
      ctx.beginPath();
      ctx.moveTo(x, Math.random() * 1024);
      ctx.lineTo(x + (Math.random() - 0.5) * 6, Math.random() * 1024);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

function Shell({ rough }: { rough: THREE.Texture }) {
  const boards = useFloorBoards();
  const side = useSideWall();
  const w = ROOM.x1 - ROOM.x0;
  const d = ROOM.z1 - ROOM.z0;
  const h = ROOM.wallTop - ROOM.floorY;
  const cx = (ROOM.x0 + ROOM.x1) / 2;
  const cz = (ROOM.z0 + ROOM.z1) / 2;
  const cy = (ROOM.floorY + ROOM.wallTop) / 2;

  const sideWall = useMemo(() => {
    /*
     * The plane is turned a quarter turn about Y, which maps its local +X onto
     * world −Z. So the opening's local position is the room's centre depth
     * minus the window's, not the window's own coordinate.
     */
    const hx = d / 2;
    const hy = h / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hx, -hy);
    shape.lineTo(hx, -hy);
    shape.lineTo(hx, hy);
    shape.lineTo(-hx, hy);
    shape.lineTo(-hx, -hy);

    const ox = cz - WINDOW.z;
    const oy = WINDOW.y - cy;
    const hole = new THREE.Path();
    hole.moveTo(ox - WINDOW.w / 2, oy - WINDOW.h / 2);
    hole.lineTo(ox - WINDOW.w / 2, oy + WINDOW.h / 2);
    hole.lineTo(ox + WINDOW.w / 2, oy + WINDOW.h / 2);
    hole.lineTo(ox + WINDOW.w / 2, oy - WINDOW.h / 2);
    hole.lineTo(ox - WINDOW.w / 2, oy - WINDOW.h / 2);
    shape.holes.push(hole);

    const g = new THREE.ShapeGeometry(shape, 4);
    const pos = g.attributes.position;
    const uv: number[] = [];
    for (let i = 0; i < pos.count; i += 1) {
      uv.push((pos.getX(i) + hx) / d, (pos.getY(i) + hy) / h);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }, [d, h, cy, cz]);

  return (
    <group>
      {/* Floor slab, thick enough to show an edge from above. */}
      <mesh position={[cx, ROOM.floorY - 0.2, cz]} receiveShadow castShadow>
        <boxGeometry args={[w, 0.4, d]} />
        <meshStandardMaterial map={boards} roughnessMap={rough} roughness={0.9} />
      </mesh>

      {/*
        Left wall, inward-facing, with the window cut out of it.
        
        A real hole, not a bright rectangle painted on: the wall casts shadows,
        so without one the sun outside would light the room straight through
        solid plaster and the mullions would throw nothing.
      */}
      <mesh
        geometry={sideWall}
        position={[ROOM.x0, cy, cz]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial map={side} roughnessMap={rough} roughness={0.95} />
      </mesh>

      {/*
        Capping strips along the tops of both walls, facing up. They are what
        make the cutaway read as a box with walls rather than as two flat
        backdrops, and being one-sided they stay invisible from below.
      */}
      <mesh
        position={[cx, ROOM.wallTop, ROOM.z0 - 0.16]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[w + 0.32, 0.32]} />
        <meshStandardMaterial color="#e0cbaa" roughness={0.9} />
      </mesh>
      <mesh
        position={[ROOM.x0 - 0.16, ROOM.wallTop, cz]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      >
        <planeGeometry args={[d, 0.32]} />
        <meshStandardMaterial color="#e0cbaa" roughness={0.9} />
      </mesh>

      {/* Skirting, where each wall meets the floor. */}
      <mesh position={[cx, ROOM.floorY + 0.17, ROOM.z0 + 0.06]} castShadow>
        <boxGeometry args={[w, 0.34, 0.12]} />
        <meshStandardMaterial color="#e6d6bc" roughness={0.8} roughnessMap={rough} />
      </mesh>
      <mesh position={[ROOM.x0 + 0.06, ROOM.floorY + 0.17, cz]} castShadow>
        <boxGeometry args={[0.12, 0.34, d]} />
        <meshStandardMaterial color="#e6d6bc" roughness={0.8} roughnessMap={rough} />
      </mesh>
    </group>
  );
}

/* --------------------------------- floor --------------------------------- */

/** A rug under the desk, and the chair pulled out from it. */
function Rug({ rough }: { rough: THREE.Texture }) {
  const border = useMemo(() => {
    const outer = roundedShape(8.8, 5.6, 0.34);
    outer.holes.push(new THREE.Path(roundedShape(8.3, 5.1, 0.3).getPoints(40)));
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.004, bevelEnabled: false, curveSegments: 12 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedShape(9.4, 6.2, 0.4), {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 2,
      curveSegments: 12,
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group position={[0, ROOM.floorY, 2.4]}>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#cfc5b3" roughness={0.98} roughnessMap={rough} />
      </mesh>
      {/* A woven border, a shade darker, inset from the edge. */}
      <mesh geometry={border} position={[0, 0.055, 0]} receiveShadow>
        <meshStandardMaterial color="#b7ab95" roughness={0.98} roughnessMap={rough} />
      </mesh>
    </group>
  );
}

function Chair({ rough }: { rough: THREE.Texture }) {
  const shell = useMemo(() => roundedBox(1.62, 1.5, 0.16, 0.3, 0.05), []);
  const cushion = useMemo(() => roundedBox(1.5, 1.38, 0.2, 0.3, 0.07), []);
  const backFrame = useMemo(() => roundedBox(1.5, 1.9, 0.12, 0.4, 0.04), []);
  const backPad = useMemo(() => roundedBox(1.34, 1.72, 0.17, 0.36, 0.06), []);
  const arm = useMemo(() => roundedBox(0.16, 0.5, 0.62, 0.06, 0.03), []);
  // Seat height comes from the desk: its top is 2.88 above the floor, which is
  // 740mm, so a 450mm seat sits 1.75 units up.
  const seatY = ROOM.floorY + 1.75;

  return (
    <group position={[0.4, 0, 4.15]} rotation={[0, Math.PI + 0.12, 0]}>
      {/* Seat: a shell with a cushion proud of it, not one flat slab. */}
      <mesh geometry={shell} position={[0, seatY - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color="#4a4c50" roughness={0.72} roughnessMap={rough} />
      </mesh>
      <mesh geometry={cushion} position={[0, seatY + 0.11, 0.02]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color="#eae5dc" roughness={0.86} roughnessMap={rough} />
      </mesh>

      {/* The spine, which is what was missing: the back has to join the seat. */}
      <mesh position={[0, seatY + 0.22, -0.72]} rotation={[0.34, 0, 0]} castShadow>
        <boxGeometry args={[0.26, 0.62, 0.16]} />
        <meshStandardMaterial color="#3d3f42" roughness={0.5} metalness={0.35} />
      </mesh>

      <group position={[0, seatY + 1.08, -0.9]} rotation={[-0.19, 0, 0]}>
        <mesh geometry={backFrame} castShadow>
          <meshStandardMaterial color="#4a4c50" roughness={0.7} roughnessMap={rough} />
        </mesh>
        <mesh geometry={backPad} position={[0, 0, 0.06]} castShadow>
          <meshStandardMaterial color="#eae5dc" roughness={0.86} roughnessMap={rough} />
        </mesh>
      </group>

      {/* Armrests. */}
      {[-0.86, 0.86].map((x) => (
        <group key={x} position={[x, seatY + 0.12, -0.12]}>
          <mesh position={[0, 0.24, -0.2]} castShadow>
            <boxGeometry args={[0.1, 0.5, 0.12]} />
            <meshStandardMaterial color="#3d3f42" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh geometry={arm} position={[0, 0.52, 0.04]} castShadow>
            <meshStandardMaterial color="#2f3134" roughness={0.62} roughnessMap={rough} />
          </mesh>
        </group>
      ))}

      {/* Gas lift: a chrome ram inside a black sleeve. */}
      <mesh position={[0, seatY - 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, 0.72, 18]} />
        <meshStandardMaterial color="#b9bcc0" roughness={0.24} metalness={0.85} />
      </mesh>
      <mesh position={[0, seatY - 0.92, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.62, 20]} />
        <meshStandardMaterial color="#2c2e31" roughness={0.42} metalness={0.4} />
      </mesh>

      {/* Five arms, each with a fork and a castor that actually meets the floor. */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a2 = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a2, 0]}>
            <mesh position={[0, ROOM.floorY + 0.3, 0.46]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[0.17, 0.11, 0.94]} />
              <meshStandardMaterial color="#33353a" roughness={0.46} metalness={0.4} />
            </mesh>
            <mesh position={[0, ROOM.floorY + 0.19, 0.9]} castShadow>
              <boxGeometry args={[0.09, 0.2, 0.1]} />
              <meshStandardMaterial color="#26282b" roughness={0.5} />
            </mesh>
            <mesh position={[0, ROOM.floorY + 0.1, 0.9]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.07, 16]} />
              <meshStandardMaterial color="#1e2022" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * The corner plant, and a standing lamp opposite it.
 *
 * The plant is grown, not scattered: a trunk, stems that branch off it, and a
 * leaf on a petiole at the end of each. The first version placed leaves at
 * points in the air around a pot with nothing joining them to anything, which
 * is exactly what it looked like.
 */
function FloorPieces({ rough }: { rough: THREE.Texture }) {
  const leaf = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.3, 0.4, 0.72, 0.32, 1, 0);
    shape.bezierCurveTo(0.72, -0.32, 0.3, -0.4, 0, 0);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 12,
    });
    g.computeVertexNormals();
    return g;
  }, []);

  const plant = useMemo(() => {
    const rng = (n: number) => (((Math.sin(n * 45.31) * 43758.5453) % 1) + 1) % 1;
    const base = ROOM.floorY + 1.05;
    const stems: Array<{ tube: THREE.BufferGeometry; tip: THREE.Vector3; dir: THREE.Vector3 }> = [];

    for (let i = 0; i < 9; i += 1) {
      const a2 = (i / 9) * Math.PI * 2 + rng(i) * 0.5;
      const lean = 0.55 + rng(i + 3) * 1.15;
      const rise = 1.5 + rng(i + 6) * 1.75;
      const mid = new THREE.Vector3(
        Math.cos(a2) * lean * 0.35,
        base + rise * 0.55,
        Math.sin(a2) * lean * 0.35,
      );
      const tip = new THREE.Vector3(Math.cos(a2) * lean, base + rise, Math.sin(a2) * lean);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, base - 0.1, 0),
        new THREE.Vector3(Math.cos(a2) * 0.12, base + rise * 0.22, Math.sin(a2) * 0.12),
        mid,
        tip,
      ]);
      stems.push({
        tube: new THREE.TubeGeometry(curve, 26, 0.032, 6, false),
        tip,
        dir: tip.clone().sub(mid).normalize(),
      });
    }
    return { stems, base };
  }, []);

  return (
    <group>
      <group position={[-5.5, 0, 2.9]}>
        <mesh position={[0, ROOM.floorY + 0.55, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.62, 0.48, 1.1, 26]} />
          <meshStandardMaterial color="#d9cfc0" roughness={0.9} roughnessMap={rough} />
        </mesh>
        <mesh position={[0, ROOM.floorY + 1.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.6, 24]} />
          <meshStandardMaterial color="#3a2c1e" roughness={0.97} />
        </mesh>
        {/* Trunk. */}
        <mesh position={[0, plant.base + 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.085, 0.8, 12]} />
          <meshStandardMaterial color="#5e6b3f" roughness={0.85} />
        </mesh>
        {plant.stems.map((st, i) => (
          <group key={i}>
            <mesh geometry={st.tube} castShadow>
              <meshStandardMaterial color="#4c6b3a" roughness={0.84} />
            </mesh>
            <mesh
              geometry={leaf}
              position={st.tip}
              rotation={[
                Math.atan2(st.dir.y, 1) * 0.6 - 0.5,
                -Math.atan2(st.dir.z, st.dir.x),
                0.35,
              ]}
              scale={0.62 + (i % 4) * 0.09}
              castShadow
            >
              <meshStandardMaterial
                color={i % 3 === 0 ? '#2f5230' : '#3d6b39'}
                roughness={0.66}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[5.6, 0, 3.4]}>
        <mesh position={[0, ROOM.floorY + 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.55, 0.1, 24]} />
          <meshStandardMaterial color="#37383b" roughness={0.55} metalness={0.4} />
        </mesh>
        <mesh position={[0, ROOM.floorY + 2.0, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 3.9, 14]} />
          <meshStandardMaterial color="#37383b" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, ROOM.floorY + 4.1, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.5, 0.9, 30, 1, true]} />
          <meshStandardMaterial
            color="#fff1da"
            emissive="#ffc078"
            emissiveIntensity={0.55}
            roughness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
        <pointLight
          position={[0, ROOM.floorY + 4.0, 0]}
          intensity={7}
          distance={11}
          decay={1.9}
          color="#ffbe80"
        />
      </group>
    </group>
  );
}

/**
 * A window in the side wall, and the evening coming through it.
 *
 * The room had one light direction and two flat walls. This gives it a second
 * source with a reason to exist, a hard edge for the sill to throw a shadow
 * from, and something on the wall that is not paint.
 */
const WINDOW = { z: 1.6, y: 1.5, w: 3.4, h: 3.5 };

function useDusk(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#7fa6c4');
    g.addColorStop(0.42, '#e0a469');
    g.addColorStop(0.72, '#c9743f');
    g.addColorStop(1, '#4a3524');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
    // A rooftop or two, so it is a view and not a gradient.
    ctx.fillStyle = '#3a2b21';
    ctx.fillRect(0, 196, 40, 60);
    ctx.fillRect(52, 214, 30, 42);
    ctx.fillRect(96, 204, 32, 52);
    ctx.fillStyle = 'rgba(255, 208, 140, 0.75)';
    for (let i = 0; i < 14; i += 1) {
      ctx.fillRect(4 + (i % 4) * 9, 206 + Math.floor(i / 4) * 12, 4, 5);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Window({ rough }: { rough: THREE.Texture }) {
  const dusk = useDusk();
  const frame = useMemo(() => {
    const outer = roundedShape(WINDOW.w + 0.4, WINDOW.h + 0.4, 0.05);
    outer.holes.push(new THREE.Path(roundedShape(WINDOW.w, WINDOW.h, 0.03).getPoints(8)));
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 6,
    });
    g.translate(0, 0, -0.1);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group position={[ROOM.x0, WINDOW.y, WINDOW.z]} rotation={[0, Math.PI / 2, 0]}>
      {/* The view out, set back in the reveal. */}
      <mesh position={[0, 0, -0.34]}>
        <planeGeometry args={[WINDOW.w + 0.2, WINDOW.h + 0.2]} />
        <meshBasicMaterial map={dusk} toneMapped={false} />
      </mesh>

      {/* The reveal: the thickness of the wall around the opening. */}
      <mesh position={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[WINDOW.w + 0.36, WINDOW.h + 0.36, 0.34]} />
        <meshStandardMaterial color="#d8ccb6" roughness={0.9} roughnessMap={rough} side={THREE.BackSide} />
      </mesh>

      <mesh geometry={frame} castShadow>
        <meshStandardMaterial color="#f4ecdd" roughness={0.78} roughnessMap={rough} />
      </mesh>

      {/* Glazing bars, which are what throw the cross onto the floor. */}
      <mesh position={[0, 0, -0.02]} castShadow>
        <boxGeometry args={[0.075, WINDOW.h, 0.08]} />
        <meshStandardMaterial color="#f4ecdd" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.4, -0.02]} castShadow>
        <boxGeometry args={[WINDOW.w, 0.075, 0.08]} />
        <meshStandardMaterial color="#f4ecdd" roughness={0.78} />
      </mesh>

      <mesh position={[0, -WINDOW.h / 2 - 0.28, 0.16]} castShadow receiveShadow>
        <boxGeometry args={[WINDOW.w + 0.74, 0.16, 0.5]} />
        <meshStandardMaterial color="#efe5d2" roughness={0.86} roughnessMap={rough} />
      </mesh>

      {/* A curtain, gathered: four folds rather than one slab. */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[WINDOW.w / 2 + 0.34 + i * 0.19, 0.14, 0.28 + (i % 2) * 0.12]}
          castShadow
        >
          <cylinderGeometry args={[0.13, 0.16, WINDOW.h + 1.0, 10, 1, false, 0, Math.PI]} />
          <meshStandardMaterial
            color="#c8bb9f"
            roughness={0.97}
            roughnessMap={rough}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/*
        The evening, from outside. A spotlight rather than a point so it throws
        a shaped pool, and it sits beyond the wall so the glazing bars stand
        between it and the room.
      */}
      <SunThroughWindow />
    </group>
  );
}

/** Placed in world space, so it is outside the window group's rotation. */
function SunThroughWindow() {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(1.4, ROOM.floorY, 3.4);
    return o;
  }, []);
  return (
    <>
      <primitive object={target} />
      <spotLight
        position={[0, 0.4, -2.4]}
        target={target}
        angle={0.62}
        penumbra={0.55}
        intensity={95}
        distance={26}
        decay={1.5}
        color="#ffb877"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0012}
      />
    </>
  );
}

/* -------------------------------- posters -------------------------------- */

interface PosterSpec {
  /** 'bars' and 'grid' are wordless prints, to break up a wall of slogans. */
  kind?: 'type' | 'bars' | 'grid';
  lines?: string[];
  /** Which line to set in gold; the rest sit in the body colour. */
  accent?: number;
  paper: string;
  ink: string;
  gold: string;
  caption?: string;
}

/**
 * A framed print, drawn as type on a canvas.
 *
 * Sized from the panel rather than by guesswork: the canvas is made at the
 * poster's own aspect so the type never stretches, and the lines are fitted to
 * the width so a long one shrinks instead of running off the edge.
 */
function posterTexture(spec: PosterSpec, w: number, h: number): THREE.CanvasTexture {
  const scale = 380;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = spec.paper;
  ctx.fillRect(0, 0, W, H);

  if (spec.kind === 'bars') {
    // Bands of colour, unequal, with a wide margin: a swatch print.
    const palette = [spec.gold, spec.ink, '#3f7f8c', '#b8543f', '#6d7f4a', '#8a6ba8'];
    const m = W * 0.12;
    const inner = H - m * 2;
    let y = m;
    palette.forEach((c, i) => {
      const band = (inner / palette.length) * (i % 2 ? 0.72 : 1.28);
      ctx.fillStyle = c;
      ctx.fillRect(m, y, W - m * 2, Math.max(2, band - H * 0.012));
      y += band;
    });
  } else if (spec.kind === 'grid') {
    const m = W * 0.14;
    const cols = 4;
    const rows = 5;
    const cw = (W - m * 2) / cols;
    const ch = (H - m * 2) / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const filled = (r * cols + c) % 5 === 0 || (r + c) % 7 === 0;
        ctx.fillStyle = filled ? spec.gold : 'rgba(0,0,0,0)';
        ctx.strokeStyle = spec.ink;
        ctx.globalAlpha = filled ? 0.9 : 0.25;
        ctx.lineWidth = Math.max(1, W * 0.004);
        ctx.fillRect(m + c * cw, m + r * ch, cw - 2, ch - 2);
        ctx.strokeRect(m + c * cw, m + r * ch, cw - 2, ch - 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Paper has tooth, same as the wall.
  for (let i = 0; i < 1800; i += 1) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${
      Math.random() * 0.03
    })`;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, 0.5 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const lines = spec.lines ?? [];
  if (lines.length === 0) {
    const flat = new THREE.CanvasTexture(canvas);
    flat.colorSpace = THREE.SRGBColorSpace;
    flat.anisotropy = 8;
    return flat;
  }

  const margin = W * 0.11;
  const inner = W - margin * 2;
  const lineH = H * (0.62 / lines.length);
  const top = H * 0.5 - (lines.length * lineH) / 2 + lineH * 0.5;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    let size = lineH * 0.82;
    const font = (px: number) =>
      `700 ${px}px ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif`;
    ctx.font = font(size);
    // Shrink to fit rather than overflow.
    while (ctx.measureText(line).width > inner && size > 8) {
      size -= 2;
      ctx.font = font(size);
    }
    ctx.fillStyle = i === spec.accent ? spec.gold : spec.ink;
    ctx.fillText(line, W / 2, top + i * lineH);
  });

  // A gold rule under the block, and the caption below it.
  const ruleY = top + lines.length * lineH - lineH * 0.18;
  ctx.strokeStyle = spec.gold;
  ctx.lineWidth = Math.max(2, H * 0.006);
  ctx.beginPath();
  ctx.moveTo(W * 0.32, ruleY);
  ctx.lineTo(W * 0.68, ruleY);
  ctx.stroke();

  if (spec.caption) {
    ctx.fillStyle = spec.ink;
    ctx.globalAlpha = 0.62;
    ctx.font = `500 ${H * 0.032}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(spec.caption, W / 2, ruleY + H * 0.075);
    ctx.globalAlpha = 1;
  }

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Poster({
  spec,
  x,
  y,
  w,
  h,
  rough,
}: {
  spec: PosterSpec;
  x: number;
  y: number;
  w: number;
  h: number;
  rough: THREE.Texture;
}) {
  const texture = useMemo(() => posterTexture(spec, w, h), [spec, w, h]);
  const frame = useMemo(() => roundedBox(w + 0.1, h + 0.1, 0.05, 0.02, 0.01), [w, h]);
  return (
    <group position={[x, y, WALL_Z + 0.03]}>
      <mesh geometry={frame} castShadow>
        <meshStandardMaterial color="#2a2523" roughness={0.7} roughnessMap={rough} />
      </mesh>
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} roughness={0.86} />
      </mesh>
    </group>
  );
}

/*
 * A gallery wall.
 *
 * Hung low enough to be inside the framed views: at the height the first three
 * went up, the top of every frame sat above where the Front camera cuts the
 * wall and all of them were beheaded. Nothing sits in the band the machine
 * occupies either, except the one across the top which clears its crown.
 */
const GOLD = '#d8a94b';

const POSTERS: Array<{ spec: PosterSpec; x: number; y: number; w: number; h: number }> = [
  {
    spec: {
      lines: ['OLD', 'IS', 'GOLD'],
      accent: 2,
      paper: '#1d1b19',
      ink: '#e6e0d4',
      gold: GOLD,
      caption: 'BONDI BLUE · 1998',
    },
    x: -3.85,
    y: 2.52,
    w: 1.08,
    h: 1.5,
  },
  {
    spec: {
      lines: ['FORM', 'FOLLOWS', 'FUNCTION'],
      accent: 2,
      paper: '#efe7d7',
      ink: '#2b2724',
      gold: '#b8862c',
    },
    x: 3.85,
    y: 2.52,
    w: 1.08,
    h: 1.5,
  },
  {
    spec: { lines: ['LESS, BUT BETTER'], paper: '#25302f', ink: '#e8efec', gold: GOLD },
    x: 0,
    y: 2.9,
    w: 1.8,
    h: 0.62,
  },
  {
    spec: { lines: ['1998'], paper: '#1c4e5c', ink: '#eaf4f6', gold: '#9fdbe8' },
    x: -2.5,
    y: 3.06,
    w: 0.78,
    h: 0.78,
  },
  {
    spec: { lines: ['DETAILS', 'MATTER'], accent: 1, paper: '#f1ece1', ink: '#2b2724', gold: '#b8862c' },
    x: 2.5,
    y: 3.06,
    w: 0.78,
    h: 0.96,
  },
  {
    spec: { kind: 'bars', paper: '#f3eee3', ink: '#2f2b27', gold: GOLD },
    x: -2.42,
    y: 1.72,
    w: 0.86,
    h: 1.12,
  },
  {
    spec: { kind: 'grid', paper: '#191d1f', ink: '#cfd8da', gold: GOLD },
    x: 2.42,
    y: 1.72,
    w: 0.86,
    h: 1.12,
  },
  {
    spec: { lines: ['PROTOTYPE', 'TEST', 'REPEAT'], accent: 2, paper: '#2a211b', ink: '#e8ded0', gold: GOLD },
    x: -4.9,
    y: 1.62,
    w: 0.86,
    h: 1.16,
  },
  {
    spec: { lines: ['SHIP', 'IT'], accent: 1, paper: '#efe7d7', ink: '#2b2724', gold: '#b8862c' },
    x: 4.9,
    y: 1.62,
    w: 0.86,
    h: 1.16,
  },
  {
    spec: { lines: ['KEEP', 'IT', 'SIMPLE'], accent: 2, paper: '#1f2a2e', ink: '#e2ebee', gold: GOLD },
    x: -4.95,
    y: 3.0,
    w: 0.8,
    h: 1.04,
  },
  {
    spec: { kind: 'bars', paper: '#20201f', ink: '#e4ded2', gold: GOLD },
    x: 4.95,
    y: 3.0,
    w: 0.8,
    h: 1.04,
  },
];

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
          <meshStandardMaterial color="#7d5730" roughness={0.88} roughnessMap={rough} />
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
  const props = useMemo(() => {
    const t = mottle(256, 0.35, 1100);
    t.repeat.set(3, 3);
    return t;
  }, []);
  const top = useMemo(() => deskTop(), []);
  const leg = useMemo(() => frustumY(0.19, 0.19, 0.13, 0.13, 2.7), []);
  const legX = DESK.w / 2 - 0.62;
  const legZ = DESK.d / 2 - 0.62;

  return (
    <group>
      <mesh
        position={[0, (ROOM.floorY + ROOM.wallTop) / 2, WALL_Z]}
        receiveShadow
      >
        <planeGeometry args={[ROOM.x1 - ROOM.x0, ROOM.wallTop - ROOM.floorY]} />
        <meshStandardMaterial map={wall.map} roughnessMap={wall.rough} roughness={0.96} />
      </mesh>

      <mesh geometry={top} receiveShadow castShadow>
        <meshStandardMaterial
          map={wood.map}
          roughnessMap={wood.rough}
          /*
           * Matte. Around 0.5 a standard material's specular lobe is at its
           * broadest, so an oiled-looking desk came out marbled with soft grey
           * patches wherever a lamp could see it. Wood at this scale is 0.85+.
           */
          roughness={0.88}
          metalness={0}
        />
      </mesh>

      {[
        [-legX, DESK.cz - legZ],
        [legX, DESK.cz - legZ],
        [-legX, DESK.cz + legZ],
        [legX, DESK.cz + legZ],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} geometry={leg} position={[x, -2.87, z]} castShadow>
          <meshStandardMaterial color="#6b4a28" roughness={0.9} roughnessMap={props} />
        </mesh>
      ))}

      <Shell rough={props} />

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
      {POSTERS.map((p) => (
        <Poster key={p.x + ':' + p.y} {...p} rough={props} />
      ))}
      <Rug rough={props} />
      <Chair rough={props} />
      <FloorPieces rough={props} />
      <Window rough={props} />
      <Shelves rough={props} />
    </group>
  );
}
