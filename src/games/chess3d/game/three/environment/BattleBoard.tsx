
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BoardTextures } from "../boardTextures";
import { BladeBuilder, GrassBlades } from "./Grass";
import { CURB_IN, CURB_OUT, CURB_TOP } from "./layout";
import { rng } from "./noise";

const FILES = "abcdefgh";
const BOARD_GRASS = ["#5d8a2c", "#6f9c34", "#4f7a26", "#86ab45", "#3f6a20"];
const CENTER = new Set(["d4", "e4", "d5", "e5"]);

interface Block {
  x: number;
  z: number;
  sx: number;
  sz: number;
  top: number;
  tint: number;
}

function curbBlocks(): Block[] {
  const r = rng(2024);
  const out: Block[] = [];
  const depth = CURB_OUT - CURB_IN - 0.04;
  const mid = (CURB_IN + CURB_OUT) / 2;
  const run = (horizontal: boolean, fixed: number, from: number, to: number) => {
    let p = from;
    while (p < to - 0.05) {
      const len = Math.min(to - p, 0.65 + r() * 0.75);
      const c = p + len / 2;
      out.push({
        x: horizontal ? c : fixed,
        z: horizontal ? fixed : c,
        sx: horizontal ? len - 0.035 : depth,
        sz: horizontal ? depth : len - 0.035,
        top: CURB_TOP - r() * 0.012,
        tint: r(),
      });
      p += len;
    }
  };
  run(true, mid, -CURB_IN, CURB_IN);
  run(true, -mid, -CURB_IN, CURB_IN);
  run(false, mid, -CURB_IN, CURB_IN);
  run(false, -mid, -CURB_IN, CURB_IN);
  return out;
}

function boardGrass() {
  const r = rng(77);
  const b = new BladeBuilder();
  // tufts sprouting where four slabs meet and along the joints
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const x = i - 4;
      const z = j - 4;
      if (Math.abs(x) < 1.1 && Math.abs(z) < 1.1) continue; // keep the carved emblem clear
      const edge = i === 0 || i === 8 || j === 0 || j === 8;
      if (r() < (edge ? 0.85 : 0.5)) {
        const big = r() < 0.25;
        b.tuft(r, x, -0.03, z, big ? 12 : 6, big ? 0.1 : 0.06, 0.08, big ? 0.24 : 0.16, BOARD_GRASS.length);
      }
    }
  }
  for (let k = 0; k < 120; k++) {
    const line = Math.floor(r() * 9) - 4;
    const along = (r() - 0.5) * 8;
    const vertical = r() < 0.5;
    const x = vertical ? line : along;
    const z = vertical ? along : line;
    if (Math.abs(x) < 1.1 && Math.abs(z) < 1.1) continue;
    b.tuft(r, x, -0.03, z, 3, 0.025, 0.06, 0.13, BOARD_GRASS.length);
  }
  // wild grass at the foot of the curb
  for (let k = 0; k < 90; k++) {
    const side = Math.floor(r() * 4);
    const t = (r() - 0.5) * 2 * CURB_OUT;
    const o = CURB_OUT + 0.05 + r() * 0.15;
    const [x, z] = side === 0 ? [t, o] : side === 1 ? [t, -o] : side === 2 ? [o, t] : [-o, t];
    b.tuft(r, x, CURB_TOP - 0.52, z, 7, 0.14, 0.18, 0.42, BOARD_GRASS.length);
  }
  return b.build();
}

export const BattleBoard = memo(function BattleBoard({
  tex,
  onSquare,
  onHover,
}: {
  tex: BoardTextures;
  onSquare: (sq: string) => void;
  onHover: (sq: string | null) => void;
}) {
  const tileGeo = useMemo(() => new THREE.BoxGeometry(0.95, 0.16, 0.95), []);
  const blockGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const curbRef = useRef<THREE.InstancedMesh>(null);
  const blocks = useMemo(() => curbBlocks(), []);
  const grass = useMemo(() => boardGrass(), []);

  const tiles = useMemo(() => {
    const r = rng(9);
    const out: { sq: string; x: number; y: number; z: number; yaw: number; mat: THREE.Material }[] = [];
    for (let f = 0; f < 8; f++) {
      for (let rk = 1; rk <= 8; rk++) {
        const sq = `${FILES[f]}${rk}`;
        const dark = (f + rk - 1) % 2 === 0;
        const variants = dark ? tex.dark : tex.light;
        const special = CENTER.has(sq);
        out.push({
          sq,
          x: f - 3.5,
          y: -0.08 - (special ? 0 : r() * 0.014),
          z: 4.5 - rk,
          yaw: special ? 0 : (r() - 0.5) * 0.03,
          mat: special ? tex.center[sq] : variants[Math.floor(r() * variants.length)],
        });
      }
    }
    return out;
  }, [tex]);

  useLayoutEffect(() => {
    const mesh = curbRef.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    blocks.forEach((b, i) => {
      const h = b.top + 0.35;
      o.position.set(b.x, b.top - h / 2, b.z);
      o.rotation.set(0, (b.tint - 0.5) * 0.02, 0);
      o.scale.set(b.sx, h, b.sz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      const v = 0.82 + b.tint * 0.3;
      mesh.setColorAt(i, c.setRGB(v, v * (0.97 + b.tint * 0.03), v * 0.92));
    });
    // corner bastions
    const corners: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const m = (CURB_IN + CURB_OUT) / 2;
    corners.forEach(([sx, sz], k) => {
      const i = blocks.length + k;
      o.position.set(sx * m, CURB_TOP + 0.06 - 0.25, sz * m);
      o.rotation.set(0, 0, 0);
      o.scale.set(CURB_OUT - CURB_IN + 0.06, 0.62, CURB_OUT - CURB_IN + 0.06);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.setRGB(0.95, 0.93, 0.86));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blocks]);

  const m = (CURB_IN + CURB_OUT) / 2;
  const labelY = CURB_TOP + 0.012;

  return (
    <group>
      {tiles.map((t) => (
        <mesh
          key={t.sq}
          geometry={tileGeo}
          material={t.mat}
          position={[t.x, t.y, t.z]}
          rotation={[0, t.yaw, 0]}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onSquare(t.sq);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(t.sq);
          }}
          onPointerOut={() => onHover(null)}
        />
      ))}

      {/* earth bed visible in the joints between slabs */}
      <mesh material={tex.bed} position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[CURB_IN * 2, CURB_IN * 2]} />
      </mesh>

      {/* stone curb */}
      <instancedMesh ref={curbRef} args={[blockGeo, tex.curb, blocks.length + 4]} castShadow receiveShadow raycast={() => null} />
      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * m, CURB_TOP + 0.13, sz * m]} material={tex.curb} castShadow raycast={() => null}>
          <sphereGeometry args={[0.17, 14, 10]} />
        </mesh>
      ))}

      {/* board body underneath */}
      <mesh material={tex.body} position={[0, -0.32, 0]} receiveShadow raycast={() => null}>
        <boxGeometry args={[CURB_OUT * 2, 0.5, CURB_OUT * 2]} />
      </mesh>

      <GrassBlades data={grass} palette={BOARD_GRASS} amp={0.18} />

      {/* coordinates engraved into the curb */}
      {FILES.split("").map((ch, i) => (
        <group key={ch}>
          <mesh position={[i - 3.5, labelY, m]} rotation={[-Math.PI / 2, 0, 0]} material={tex.labels[ch]} raycast={() => null}>
            <planeGeometry args={[0.42, 0.42]} />
          </mesh>
          <mesh position={[i - 3.5, labelY, -m]} rotation={[-Math.PI / 2, 0, Math.PI]} material={tex.labels[ch]} raycast={() => null}>
            <planeGeometry args={[0.42, 0.42]} />
          </mesh>
        </group>
      ))}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <group key={n}>
          <mesh position={[-m, labelY, 4.5 - n]} rotation={[-Math.PI / 2, 0, 0]} material={tex.labels[String(n)]} raycast={() => null}>
            <planeGeometry args={[0.42, 0.42]} />
          </mesh>
          <mesh position={[m, labelY, 4.5 - n]} rotation={[-Math.PI / 2, 0, Math.PI]} material={tex.labels[String(n)]} raycast={() => null}>
            <planeGeometry args={[0.42, 0.42]} />
          </mesh>
        </group>
      ))}
    </group>
  );
});
