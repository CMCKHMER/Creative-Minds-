/* eslint-disable react-hooks/immutability -- react-three-fiber useFrame mutates render-scoped scratch objects every frame; imperative animation is the r3f idiom, not a React state bug */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { surfaceY } from "./environment/layout";
import { rng } from "./environment/noise";

export interface BloodApi {
  /** spray droplets from `origin`, mostly along `dir` (unit vector on the ground plane) */
  spray(origin: THREE.Vector3, dir: { x: number; z: number }, count: number, power: number): void;
  /** stain on the ground. variant: 0 round, 1 splatter, 2 streak (oriented by `rot`), 3 pool */
  splat(x: number, z: number, size: number, variant: number, rot?: number): void;
}

const MAX_DROPS = 520;
const MAX_DECALS = 280;
const STAY = 22;
const FADE = 5;

/** 2×2 atlas of blood stain shapes, white with darker rims (tinted by the material colour). */
function makeAtlas() {
  const size = 512;
  const half = size / 2;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = rng(666);

  const blob = (cx: number, cy: number, rad: number, wobble: number, fill: string) => {
    ctx.beginPath();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = rad * (1 + (r() - 0.5) * wobble);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const shaded = (cx: number, cy: number, rad: number, wobble: number) => {
    blob(cx, cy, rad, wobble, "rgba(150,150,150,1)");
    blob(cx, cy, rad * 0.82, wobble * 0.6, "rgba(225,225,225,1)");
    blob(cx - rad * 0.15, cy - rad * 0.2, rad * 0.3, 0.3, "rgba(255,255,255,1)");
  };
  const cell = (i: number, fn: (cx: number, cy: number) => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect((i % 2) * half, Math.floor(i / 2) * half, half, half);
    ctx.clip();
    fn((i % 2) * half + half / 2, Math.floor(i / 2) * half + half / 2);
    ctx.restore();
  };

  // 0: round splat
  cell(0, (cx, cy) => shaded(cx, cy, 70, 0.35));
  // 1: splatter with satellite drops
  cell(1, (cx, cy) => {
    shaded(cx, cy, 55, 0.6);
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const d = 60 + r() * 55;
      shaded(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3 + r() * 9, 0.3);
    }
  });
  // 2: streak pointing "up" in the texture (towards the attack direction)
  cell(2, (cx, cy) => {
    shaded(cx, cy + 50, 42, 0.5);
    for (let i = 0; i < 9; i++) {
      const w = 5 + r() * 10;
      const x = cx + (r() - 0.5) * 70;
      const len = 60 + r() * 70;
      ctx.fillStyle = "rgba(200,200,200,1)";
      ctx.beginPath();
      ctx.ellipse(x, cy + 30 - len / 2, w / 2, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      shaded(x, cy + 30 - len - 6, w * 0.8, 0.2);
    }
  });
  // 3: pool with a soft rim
  cell(3, (cx, cy) => {
    blob(cx, cy, 108, 0.18, "rgba(110,110,110,1)");
    blob(cx, cy, 98, 0.16, "rgba(190,190,190,1)");
    blob(cx, cy, 80, 0.12, "rgba(230,230,230,1)");
    blob(cx - 30, cy - 30, 26, 0.3, "rgba(255,255,255,1)");
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** UV offset (in atlas halves) for canvas cell i; CanvasTexture flips Y. */
const CELL_UV: [number, number][] = [
  [0, 0.5],
  [0.5, 0.5],
  [0, 0],
  [0.5, 0],
];

export function Blood({ apiRef }: { apiRef: MutableRefObject<BloodApi | null> }) {
  const dropsRef = useRef<THREE.InstancedMesh>(null);
  const decalsRef = useRef<THREE.InstancedMesh>(null);

  const st = useMemo(
    () => ({
      dPos: new Float32Array(MAX_DROPS * 3),
      dVel: new Float32Array(MAX_DROPS * 3),
      dSize: new Float32Array(MAX_DROPS),
      dAlive: new Uint8Array(MAX_DROPS),
      dNext: 0,
      sX: new Float32Array(MAX_DECALS),
      sY: new Float32Array(MAX_DECALS),
      sZ: new Float32Array(MAX_DECALS),
      sRot: new Float32Array(MAX_DECALS),
      sSize: new Float32Array(MAX_DECALS),
      sAge: new Float32Array(MAX_DECALS).fill(999),
      sGrow: new Float32Array(MAX_DECALS),
      sNext: 0,
      o: new THREE.Object3D(),
      up: new THREE.Vector3(0, 1, 0),
      v: new THREE.Vector3(),
    }),
    [],
  );

  const dropGeo = useMemo(() => new THREE.SphereGeometry(1, 7, 5), []);
  const dropMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#7a0309", roughness: 0.15, metalness: 0.1, emissive: "#260002", emissiveIntensity: 0.6 }),
    [],
  );
  const decalGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    g.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array(MAX_DECALS), 1));
    g.setAttribute("aUvOff", new THREE.InstancedBufferAttribute(new Float32Array(MAX_DECALS * 2), 2));
    return g;
  }, []);
  const decalMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map: makeAtlas(),
      color: "#6a0208",
      roughness: 0.18,
      metalness: 0.05,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader =
        "attribute float aAlpha;\nattribute vec2 aUvOff;\nvarying float vAlpha;\n" +
        sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n  vMapUv = vMapUv * 0.5 + aUvOff;\n  vAlpha = aAlpha;");
      sh.fragmentShader =
        "varying float vAlpha;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.a *= vAlpha;");
    };
    m.customProgramCacheKey = () => "blood-decal";
    return m;
  }, []);

  useEffect(() => {
    const splat: BloodApi["splat"] = (x, z, size, variant, rot) => {
      const i = st.sNext;
      st.sNext = (st.sNext + 1) % MAX_DECALS;
      st.sX[i] = x;
      st.sZ[i] = z;
      st.sY[i] = surfaceY(x, z) + 0.006;
      st.sRot[i] = rot ?? Math.random() * Math.PI * 2;
      st.sSize[i] = size;
      st.sAge[i] = 0;
      st.sGrow[i] = variant === 3 ? 1.8 : 0.18;
      const uv = decalGeo.getAttribute("aUvOff") as THREE.InstancedBufferAttribute;
      const [u, v] = CELL_UV[variant & 3];
      uv.setXY(i, u, v);
      uv.needsUpdate = true;
    };
    const spray: BloodApi["spray"] = (origin, dir, count, power) => {
      const px = -dir.z;
      const pz = dir.x;
      for (let k = 0; k < count; k++) {
        const i = st.dNext;
        st.dNext = (st.dNext + 1) % MAX_DROPS;
        const fwd = power * (0.35 + Math.random() * 0.9);
        const side = power * (Math.random() - 0.5) * 0.9;
        st.dPos[i * 3] = origin.x + (Math.random() - 0.5) * 0.12;
        st.dPos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.15;
        st.dPos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.12;
        st.dVel[i * 3] = dir.x * fwd + px * side;
        st.dVel[i * 3 + 1] = power * (0.25 + Math.random() * 0.8);
        st.dVel[i * 3 + 2] = dir.z * fwd + pz * side;
        st.dSize[i] = 0.012 + Math.random() * 0.026;
        st.dAlive[i] = 1;
      }
    };
    apiRef.current = { spray, splat };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, st, decalGeo]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const o = st.o;

    // droplets
    const drops = dropsRef.current;
    if (drops) {
      for (let i = 0; i < MAX_DROPS; i++) {
        if (st.dAlive[i]) {
          const k = i * 3;
          st.dVel[k + 1] -= 9.8 * dt;
          st.dPos[k] += st.dVel[k] * dt;
          st.dPos[k + 1] += st.dVel[k + 1] * dt;
          st.dPos[k + 2] += st.dVel[k + 2] * dt;
          const ground = surfaceY(st.dPos[k], st.dPos[k + 2]);
          if (st.dPos[k + 1] <= ground + 0.01) {
            st.dAlive[i] = 0;
            if (Math.random() < 0.7) {
              apiRef.current?.splat(st.dPos[k], st.dPos[k + 2], st.dSize[i] * (5 + Math.random() * 6), Math.random() < 0.6 ? 0 : 1);
            }
          }
        }
        if (st.dAlive[i]) {
          const k = i * 3;
          st.v.set(st.dVel[k], st.dVel[k + 1], st.dVel[k + 2]);
          const speed = st.v.length();
          o.position.set(st.dPos[k], st.dPos[k + 1], st.dPos[k + 2]);
          if (speed > 0.01) o.quaternion.setFromUnitVectors(st.up, st.v.multiplyScalar(1 / speed));
          const s = st.dSize[i];
          o.scale.set(s, s * (1 + Math.min(speed * 0.35, 2.5)), s);
        } else {
          o.position.set(0, -100, 0);
          o.scale.setScalar(0);
        }
        o.updateMatrix();
        drops.setMatrixAt(i, o.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;
    }

    // stains
    const decals = decalsRef.current;
    if (decals) {
      const alpha = decalGeo.getAttribute("aAlpha") as THREE.InstancedBufferAttribute;
      o.quaternion.identity();
      for (let i = 0; i < MAX_DECALS; i++) {
        const age = st.sAge[i];
        if (age < STAY + FADE) {
          st.sAge[i] = age + dt;
          const g = Math.min(1, age / st.sGrow[i]);
          const grow = 1 - Math.pow(1 - g, 3);
          const s = st.sSize[i] * (0.25 + 0.75 * grow);
          o.position.set(st.sX[i], st.sY[i], st.sZ[i]);
          o.rotation.set(0, st.sRot[i], 0);
          o.scale.set(s, 1, s);
          alpha.setX(i, age < STAY ? 0.95 : 0.95 * (1 - (age - STAY) / FADE));
        } else {
          o.position.set(0, -100, 0);
          o.scale.setScalar(0);
          alpha.setX(i, 0);
        }
        o.updateMatrix();
        decals.setMatrixAt(i, o.matrix);
      }
      decals.instanceMatrix.needsUpdate = true;
      alpha.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={dropsRef} args={[dropGeo, dropMat, MAX_DROPS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={decalsRef} args={[decalGeo, decalMat, MAX_DECALS]} frustumCulled={false} renderOrder={1} raycast={() => null} receiveShadow />
    </>
  );
}
