
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeBanner, makeBlob, makeCloud, type BoardTextures } from "../boardTextures";
import { BladeBuilder, GrassBlades } from "./Grass";
import { CAMPS, CURB_OUT, DAIS_APOTHEM, DAIS_R, DAIS_TOP, onPath, terrainHeight } from "./layout";
import { fbm, hash2, noise2, rng, smoothstep } from "./noise";
import { addWind, windUniform } from "./wind";

export const FOG_COLOR = "#d3d4c2";
export const SUN_POS: [number, number, number] = [9, 11, 6];
const MEADOW = ["#5a8a2a", "#6c9a33", "#4a7724", "#89ad44", "#a3b450", "#3d6620"];
const TEAM_CLOTH = { w: "#2f5fc4", b: "#b3202f" } as const;

/** distance in the dais' octagonal metric */
const octDist = (x: number, z: number) => {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  return Math.max(ax, az, (ax + az) * Math.SQRT1_2);
};
const nearCamp = (x: number, z: number, d: number) => CAMPS.some((c) => Math.abs(z - c.z) < d && Math.abs(x) < d * 1.7);

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                     */
/* ------------------------------------------------------------------ */

function paint(geo: THREE.BufferGeometry, color: string, r: () => number, jitter = 0.08) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (r() - 0.5) * jitter;
    for (let v = 0; v < 3 && i + v < n; v++) {
      arr[(i + v) * 3] = c.r * k;
      arr[(i + v) * 3 + 1] = c.g * k;
      arr[(i + v) * 3 + 2] = c.b * k;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

/** Deterministic lumpy distortion (same position -> same offset, so faces stay closed). */
function lumpy(geo: THREE.BufferGeometry, amount: number) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (hash2(Math.round(x * 100) + Math.round(y * 37), Math.round(z * 100)) - 0.5) * amount;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return geo;
}

function at(geo: THREE.BufferGeometry, x: number, y: number, z: number) {
  geo.translate(x, y, z);
  return geo;
}

function pineGeometry() {
  const r = rng(1);
  return mergeGeometries([
    paint(at(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6), 0, 0.7, 0), "#5a3b22", r),
    paint(at(new THREE.ConeGeometry(1.35, 2.3, 7), 0, 2.2, 0), "#2c5427", r, 0.25),
    paint(at(new THREE.ConeGeometry(1.05, 2.0, 7), 0, 3.2, 0), "#336030", r, 0.25),
    paint(at(new THREE.ConeGeometry(0.7, 1.7, 7), 0, 4.15, 0), "#3b6c36", r, 0.25),
  ])!;
}

function oakGeometry() {
  const r = rng(2);
  const blob = (rad: number, x: number, y: number, z: number, c: string) =>
    paint(at(lumpy(new THREE.IcosahedronGeometry(rad, 1), 0.35), x, y, z), c, r, 0.3);
  return mergeGeometries([
    paint(at(new THREE.CylinderGeometry(0.14, 0.24, 2, 6), 0, 1, 0), "#5b4129", r),
    blob(1.35, 0, 2.8, 0, "#4b7a2c"),
    blob(0.95, 0.85, 2.5, 0.3, "#568733"),
    blob(1.0, -0.75, 2.6, -0.35, "#426f28"),
    blob(0.9, 0.15, 3.65, -0.1, "#5f9238"),
  ])!;
}

function bushGeometry() {
  const r = rng(3);
  const blob = (rad: number, x: number, y: number, z: number, c: string) =>
    paint(at(lumpy(new THREE.IcosahedronGeometry(rad, 1), 0.3), x, y, z), c, r, 0.3);
  return mergeGeometries([blob(0.7, 0, 0.45, 0, "#4a7a2b"), blob(0.5, 0.5, 0.35, 0.2, "#578a33"), blob(0.55, -0.45, 0.35, -0.15, "#3f6c25")])!;
}

function rockGeometry() {
  const g = lumpy(new THREE.DodecahedronGeometry(1, 1), 0.45);
  g.scale(1, 0.62, 1);
  g.computeVertexNormals();
  return g;
}

interface Inst {
  x: number;
  y: number;
  z: number;
  s: number;
  sy?: number;
  yaw: number;
  tilt?: number;
  tint: [number, number, number];
}

function Instances({
  geometry,
  material,
  items,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Inst[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(it.tilt ?? 0, it.yaw, (it.tilt ?? 0) * 0.6);
      o.scale.set(it.s, it.s * (it.sy ?? 1), it.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.setRGB(...it.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} receiveShadow raycast={() => null} />;
}

/* ------------------------------------------------------------------ */
/* Sky, clouds, mountains                                               */
/* ------------------------------------------------------------------ */

function WindClock() {
  useFrame((s) => {
    windUniform.value = s.clock.elapsedTime;
  });
  return null;
}

function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#3a6db4") },
          mid: { value: new THREE.Color("#8db7df") },
          horizon: { value: new THREE.Color("#f1d9b2") },
          ground: { value: new THREE.Color(FOG_COLOR) },
          sunDir: { value: new THREE.Vector3(...SUN_POS).normalize() },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir;
          varying vec3 vDir;
          void main(){
            float h = vDir.y;
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
            col = mix(col, top, smoothstep(0.22, 0.85, h));
            col = mix(col, ground, smoothstep(0.0, -0.08, h));
            float sd = max(dot(normalize(vDir), sunDir), 0.0);
            col += vec3(1.0, 0.82, 0.55) * (pow(sd, 6.0) * 0.28 + pow(sd, 90.0) * 0.6 + pow(sd, 1200.0) * 4.0);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-10} raycast={() => null}>
      <sphereGeometry args={[450, 32, 18]} />
    </mesh>
  );
}

function Clouds() {
  const items = useMemo(() => {
    const r = rng(8);
    return Array.from({ length: 14 }, (_, i) => {
      const a = r() * Math.PI * 2;
      const rad = 230 + r() * 110;
      const w = 90 + r() * 90;
      return {
        mat: new THREE.SpriteMaterial({ map: makeCloud(i + 1), transparent: true, fog: false, depthWrite: false, opacity: 0.85, color: "#fff7ec" }),
        pos: [Math.cos(a) * rad, 55 + r() * 60, Math.sin(a) * rad] as [number, number, number],
        scale: [w, w * 0.42, 1] as [number, number, number],
      };
    });
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.004;
  });
  return (
    <group ref={group}>
      {items.map((c, i) => (
        <sprite key={i} material={c.mat} position={c.pos} scale={c.scale} renderOrder={-9} raycast={() => null} />
      ))}
    </group>
  );
}

function ridge(rBase: number, rPeak: number, minH: number, maxH: number, rock: string, snowAt: number, seed: number) {
  const N = 240;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const base = new THREE.Color(rock).multiplyScalar(0.7);
  const rockC = new THREE.Color(rock);
  const snow = new THREE.Color("#f4f6fa");
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const n = fbm(ca * 2.2 + seed, sa * 2.2 - seed, 5);
    const jag = (hash2(i * 1.7 + seed, seed) - 0.5) * 0.12;
    const h = minH + Math.pow(Math.max(0, n - 0.25 + jag) / 0.75, 1.4) * (maxH - minH);
    const rm = (rBase + rPeak) / 2;
    const rows: [number, number, THREE.Color][] = [
      [rBase, -8, base],
      [rm, h * (0.45 + hash2(i, seed + 3) * 0.2), rockC],
      [rPeak, h, h > snowAt ? snow : rockC],
    ];
    for (const [rr, y, c] of rows) {
      pos.push(ca * rr, y, sa * rr);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 2; k++) {
      const a = i * 3 + k;
      const b = (i + 1) * 3 + k;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Mountains() {
  const [near, far] = useMemo(() => [ridge(150, 185, 6, 42, "#5e6b5a", 34, 3.3), ridge(225, 265, 20, 75, "#6c7a8c", 52, 7.7)], []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }), []);
  return (
    <group>
      <mesh geometry={near} material={mat} raycast={() => null} />
      <mesh geometry={far} material={mat} raycast={() => null} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Terrain & meadow                                                     */
/* ------------------------------------------------------------------ */

function terrainGeometry() {
  const rings: number[] = [];
  let rr = 8.0;
  while (rr < 340) {
    rings.push(rr);
    rr = rr * 1.032 + 0.12;
  }
  const seg = 200;
  const pos = new Float32Array(rings.length * seg * 3);
  const col = new Float32Array(rings.length * seg * 3);
  const uv = new Float32Array(rings.length * seg * 2);
  const g1 = new THREE.Color("#47732a");
  const g2 = new THREE.Color("#7aa63f");
  const dry = new THREE.Color("#a99b59");
  const dirt = new THREE.Color("#7a6143");
  const c = new THREE.Color();
  let p = 0;
  for (let i = 0; i < rings.length; i++) {
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2 + (i % 2) * (Math.PI / seg);
      const x = Math.cos(a) * rings[i];
      const z = Math.sin(a) * rings[i];
      const y = terrainHeight(x, z);
      pos[p * 3] = x;
      pos[p * 3 + 1] = y;
      pos[p * 3 + 2] = z;
      uv[p * 2] = x * 0.16;
      uv[p * 2 + 1] = z * 0.16;
      const n = fbm(x * 0.045, z * 0.045);
      const n2 = noise2(x * 0.3, z * 0.3);
      c.copy(g1).lerp(g2, smoothstep(0.3, 0.7, n));
      c.multiplyScalar(0.94 + n2 * 0.12);
      c.lerp(dry, 0.65 * smoothstep(0.56, 0.7, fbm(x * 0.02 + 7, z * 0.02 + 3)));
      const r = rings[i];
      c.lerp(dirt, 0.3 * (1 - smoothstep(DAIS_R + 0.5, DAIS_R + 3, r)));
      if (nearCamp(x, z, 9)) c.lerp(dirt, 0.3);
      c.lerp(dirt.clone().multiplyScalar(0.9 + n2 * 0.2), onPath(x, z) * 0.92);
      col[p * 3] = c.r;
      col[p * 3 + 1] = c.g;
      col[p * 3 + 2] = c.b;
      p++;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const b = i * seg + ((j + 1) % seg);
      const cc = (i + 1) * seg + j;
      const d = (i + 1) * seg + ((j + 1) % seg);
      idx.push(a, b, cc, b, d, cc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Terrain({ tex }: { tex: BoardTextures }) {
  const geo = useMemo(() => terrainGeometry(), []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.meadow }), [tex]);
  return <mesh geometry={geo} material={mat} receiveShadow raycast={() => null} />;
}

function Meadow() {
  const { grass, flowers } = useMemo(() => {
    const r = rng(31);
    const b = new BladeBuilder();
    const fl: Inst[] = [];
    const flowerColors: [number, number, number][] = [
      [1, 1, 0.95],
      [1, 0.86, 0.25],
      [0.72, 0.5, 1],
      [0.95, 0.2, 0.18],
      [1, 0.6, 0.8],
    ];
    let tufts = 0;
    for (let tries = 0; tufts < 2700 && tries < 60000; tries++) {
      const rad = DAIS_R - 0.6 + Math.pow(r(), 1.45) * 36;
      const a = r() * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (octDist(x, z) < DAIS_APOTHEM + 0.1) continue;
      if (onPath(x, z) > 0.2 || nearCamp(x, z, 6)) continue;
      const patch = fbm(x * 0.11 + 3, z * 0.11 - 2);
      const dens = smoothstep(0.36, 0.62, patch) + (rad < DAIS_R + 2.5 ? 0.6 : 0.12);
      if (r() > dens) continue;
      const y = terrainHeight(x, z) - 0.03;
      const tall = 0.6 + Math.min(1, dens) * 0.9;
      b.tuft(r, x, y, z, 6, 0.14, 0.18 * tall, 0.48 * tall, MEADOW.length);
      tufts++;
      if (r() < 0.16 && fl.length < 900) {
        fl.push({ x: x + (r() - 0.5) * 0.3, y: y + 0.18 + r() * 0.2, z: z + (r() - 0.5) * 0.3, s: 0.8 + r() * 0.6, yaw: r() * 6, tint: flowerColors[Math.floor(r() * flowerColors.length)] });
      }
    }
    return { grass: b.build(), flowers: fl };
  }, []);
  const flowerGeo = useMemo(() => new THREE.IcosahedronGeometry(0.06, 0), []);
  const flowerMat = useMemo(() => new THREE.MeshLambertMaterial({ emissive: "#222222" }), []);
  return (
    <group>
      <GrassBlades data={grass} palette={MEADOW} amp={0.3} />
      <Instances geometry={flowerGeo} material={flowerMat} items={flowers} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Dais, braziers, banners                                              */
/* ------------------------------------------------------------------ */

const PILLARS: [number, number][] = [
  [5.7, 5.7],
  [-5.7, 5.7],
  [5.7, -5.7],
  [-5.7, -5.7],
];
const BANNERS: { x: number; z: number; color: "w" | "b" }[] = [
  { x: 7.8, z: 2.9, color: "w" },
  { x: -7.8, z: 2.9, color: "w" },
  { x: 7.8, z: -2.9, color: "b" },
  { x: -7.8, z: -2.9, color: "b" },
];

function Dais({ tex }: { tex: BoardTextures }) {
  const mats = useMemo(() => {
    const side = tex.stone.clone();
    side.repeat.set(10, 1.2);
    side.needsUpdate = true;
    const sideMat = new THREE.MeshStandardMaterial({ map: side, color: "#b9b2a0", roughness: 0.95 });
    const topMat = new THREE.MeshStandardMaterial({ map: tex.flagstones, color: "#9a9282", roughness: 0.95 });
    const stepTex = tex.stone.clone();
    stepTex.repeat.set(3, 0.4);
    stepTex.needsUpdate = true;
    const stepMat = new THREE.MeshStandardMaterial({ map: stepTex, color: "#c4bca8", roughness: 0.92 });
    return { sideMat, topMat, stepMat };
  }, [tex]);

  const grass = useMemo(() => {
    const r = rng(55);
    const b = new BladeBuilder();
    let n = 0;
    for (let tries = 0; n < 330 && tries < 8000; tries++) {
      const x = (r() - 0.5) * 2 * DAIS_APOTHEM;
      const z = (r() - 0.5) * 2 * DAIS_APOTHEM;
      const od = octDist(x, z);
      if (od > DAIS_APOTHEM - 0.15) continue;
      if (Math.max(Math.abs(x), Math.abs(z)) < CURB_OUT + 0.2) continue;
      if (PILLARS.some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.75)) continue;
      if (BANNERS.some((bn) => Math.hypot(bn.x - x, bn.z - z) < 0.3)) continue;
      if (Math.abs(x) < 2.3 && Math.abs(z) > CURB_OUT && r() < 0.85) continue;
      const edge = od > DAIS_APOTHEM - 1.2;
      b.tuft(r, x, DAIS_TOP - 0.01, z, edge ? 9 : 5, edge ? 0.16 : 0.08, 0.1, edge ? 0.4 : 0.22, MEADOW.length);
      n++;
    }
    return b.build();
  }, []);

  const step = (z: number, i: number) => {
    const top = DAIS_TOP - 0.3 * (i + 1);
    const h = top + 2.2;
    return (
      <mesh key={`${z}${i}`} material={mats.stepMat} position={[0, top - h / 2, z * (DAIS_APOTHEM + 0.3 + i * 0.6)]} receiveShadow raycast={() => null}>
        <boxGeometry args={[4.4 - i * 0.2, h, 0.6]} />
      </mesh>
    );
  };

  return (
    <group>
      <mesh
        position={[0, DAIS_TOP - 0.95, 0]}
        rotation={[0, Math.PI / 8, 0]}
        material={[mats.sideMat, mats.topMat, mats.topMat]}
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[DAIS_R, DAIS_R + 0.35, 1.9, 8]} />
      </mesh>
      {[1, -1].map((z) => [0, 1, 2].map((i) => step(z, i)))}
      <GrassBlades data={grass} palette={MEADOW} amp={0.25} />
    </group>
  );
}

function Fire({ seed }: { seed: number }) {
  const light = useRef<THREE.PointLight>(null);
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(
    () =>
      ["#ff5a14", "#ffa63a", "#fff0b5"].map(
        (c, i) =>
          new THREE.MeshBasicMaterial({
            color: c,
            transparent: true,
            opacity: [0.75, 0.85, 0.95][i],
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [],
  );
  useFrame((s) => {
    const t = s.clock.elapsedTime + seed * 10;
    const f = 0.85 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 23.1) * 0.04;
    if (light.current) light.current.intensity = 26 * f;
    flames.current.forEach((m, i) => {
      if (!m) return;
      m.scale.set(1 + Math.sin(t * 9 + i) * 0.1, f * (1 + 0.18 * Math.sin(t * 11 + i * 2)), 1 + Math.cos(t * 8 + i) * 0.1);
      m.rotation.y = t * (0.7 + i * 0.4);
    });
  });
  const sizes: [number, number][] = [
    [0.3, 0.95],
    [0.21, 0.72],
    [0.11, 0.45],
  ];
  return (
    <group>
      <pointLight ref={light} color="#ff9440" intensity={26} distance={11} decay={2} position={[0, 0.45, 0]} />
      {sizes.map(([r, h], i) => (
        <mesh
          key={i}
          ref={(m) => {
            flames.current[i] = m;
          }}
          material={mats[i]}
          position={[0, h / 2 - 0.08, 0]}
          raycast={() => null}
        >
          <coneGeometry args={[r, h, 10, 1, true]} />
        </mesh>
      ))}
      <Sparkles count={14} scale={[0.6, 1.8, 0.6]} position={[0, 1, 0]} size={5} speed={1.6} color="#ffae5a" opacity={1} />
    </group>
  );
}

function Braziers({ tex }: { tex: BoardTextures }) {
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.stone, color: "#d6cfbd", roughness: 0.9 }), [tex]);
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a332d", roughness: 0.45, metalness: 0.8 }), []);
  const coal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a1208", emissive: "#ff4a10", emissiveIntensity: 1.4 }), []);
  const bowl = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0.12, 0],
          [0.3, 0.06],
          [0.5, 0.22],
          [0.56, 0.36],
          [0.5, 0.36],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        18,
      ),
    [],
  );
  return (
    <group>
      {PILLARS.map(([x, z], i) => (
        <group key={i} position={[x, DAIS_TOP, z]}>
          <mesh material={stone} position={[0, 0.16, 0]} castShadow raycast={() => null}>
            <boxGeometry args={[0.95, 0.32, 0.95]} />
          </mesh>
          <mesh material={stone} position={[0, 1.07, 0]} castShadow raycast={() => null}>
            <cylinderGeometry args={[0.26, 0.33, 1.5, 12]} />
          </mesh>
          <mesh material={stone} position={[0, 1.86, 0]} raycast={() => null}>
            <boxGeometry args={[0.7, 0.12, 0.7]} />
          </mesh>
          <mesh geometry={bowl} material={iron} position={[0, 1.9, 0]} raycast={() => null} />
          <mesh material={coal} position={[0, 2.18, 0]} scale={[1, 0.35, 1]} raycast={() => null}>
            <sphereGeometry args={[0.42, 14, 10]} />
          </mesh>
          <group position={[0, 2.2, 0]}>
            <Fire seed={i} />
          </group>
        </group>
      ))}
    </group>
  );
}

function Banners() {
  const pole = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4a3420", roughness: 0.7 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d9b24c", metalness: 1, roughness: 0.3 }), []);
  const cloth = useMemo(() => {
    const make = (c: "w" | "b") =>
      addWind(new THREE.MeshStandardMaterial({ map: makeBanner(c), side: THREE.DoubleSide, roughness: 0.85 }), "banner", 0.16, 2);
    return { w: make("w"), b: make("b") };
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 2, 10, 18);
    g.translate(0, -1, 0);
    return g;
  }, []);
  const H = 3.6;
  return (
    <group>
      {BANNERS.map((b, i) => (
        <group key={i} position={[b.x, DAIS_TOP, b.z]} rotation={[0, b.x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh material={pole} position={[0, H / 2, 0]} castShadow raycast={() => null}>
            <cylinderGeometry args={[0.05, 0.07, H, 8]} />
          </mesh>
          <mesh material={gold} position={[0, H + 0.08, 0]} raycast={() => null}>
            <coneGeometry args={[0.09, 0.26, 8]} />
          </mesh>
          <mesh material={pole} position={[0, H - 0.12, 0.08]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
            <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
          </mesh>
          <mesh geometry={geo} material={cloth[b.color]} position={[0, H - 0.16, 0.1]} castShadow raycast={() => null} />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Forest, rocks, ruins, camps                                          */
/* ------------------------------------------------------------------ */

function Forest() {
  const geos = useMemo(() => ({ pine: pineGeometry(), oak: oakGeometry(), bush: bushGeometry() }), []);
  const mats = useMemo(() => {
    const tree = addWind(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), "tree", 0.16, 5);
    const bush = addWind(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), "tree", 0.05, 1.2);
    const blob = new THREE.MeshBasicMaterial({ map: makeBlob(), transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
    return { tree, bush, blob };
  }, []);
  const blobGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const { pines, oaks, bushes, blobs } = useMemo(() => {
    const r = rng(5);
    const pines: Inst[] = [];
    const oaks: Inst[] = [];
    const bushes: Inst[] = [];
    const blobs: Inst[] = [];
    const tint = (k: number): [number, number, number] => [0.85 + k * 0.3, 0.88 + k * 0.25, 0.85 + k * 0.2];
    for (let tries = 0; pines.length + oaks.length < 260 && tries < 9000; tries++) {
      const rad = 17 + Math.pow(r(), 0.85) * 60;
      const a = r() * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (onPath(x, z) > 0.02 || nearCamp(x, z, 10)) continue;
      const grove = fbm(x * 0.05 + 1, z * 0.05 + 9);
      if (r() > smoothstep(0.38, 0.55, grove) + 0.05) continue;
      const kind = fbm(x * 0.03 - 4, z * 0.03 + 2) > 0.5 ? "pine" : "oak";
      const s = (0.85 + r() * 0.6) * (1 + (rad - 17) / 70);
      const it: Inst = { x, y: terrainHeight(x, z) - 0.1, z, s, sy: 0.9 + r() * 0.3, yaw: r() * 6.28, tint: tint(r()) };
      (kind === "pine" ? pines : oaks).push(it);
      if (rad < 50) blobs.push({ x: x + 0.6 * s, y: it.y + 0.14, z: z + 0.4 * s, s: s * 3.4, yaw: 0, tint: [1, 1, 1] });
    }
    for (let tries = 0; bushes.length < 130 && tries < 4000; tries++) {
      const rad = 10.5 + Math.pow(r(), 1.2) * 26;
      const a = r() * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (onPath(x, z) > 0.05 || nearCamp(x, z, 7)) continue;
      const s = 0.6 + r() * 0.8;
      const y = terrainHeight(x, z) - 0.15;
      bushes.push({ x, y, z, s, sy: 0.8 + r() * 0.4, yaw: r() * 6.28, tint: tint(r()) });
      blobs.push({ x: x + 0.3, y: y + 0.18, z: z + 0.2, s: s * 2.0, yaw: 0, tint: [1, 1, 1] });
    }
    return { pines, oaks, bushes, blobs };
  }, []);

  return (
    <group>
      <Instances geometry={geos.pine} material={mats.tree} items={pines} />
      <Instances geometry={geos.oak} material={mats.tree} items={oaks} />
      <Instances geometry={geos.bush} material={mats.bush} items={bushes} />
      <Instances geometry={blobGeo} material={mats.blob} items={blobs} />
    </group>
  );
}

function Rocks() {
  const geo = useMemo(() => rockGeometry(), []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true }), []);
  const items = useMemo(() => {
    const r = rng(17);
    const out: Inst[] = [];
    const grey = (k: number, mossy: boolean): [number, number, number] =>
      mossy ? [0.42 + k * 0.1, 0.5 + k * 0.1, 0.34 + k * 0.08] : [0.5 + k * 0.18, 0.49 + k * 0.17, 0.45 + k * 0.15];
    // stones piled at the foot of the dais
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2;
      const rad = DAIS_R + 0.1 + r() * 1.3;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (Math.abs(x) < 2.8) continue;
      out.push({ x, y: terrainHeight(x, z) + 0.02, z, s: 0.2 + r() * 0.35, yaw: r() * 6, tilt: (r() - 0.5) * 0.5, tint: grey(r(), r() < 0.4) });
    }
    for (let tries = 0; out.length < 120 && tries < 3000; tries++) {
      const rad = 12 + Math.pow(r(), 1.3) * 55;
      const a = r() * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (onPath(x, z) > 0.05 || nearCamp(x, z, 8)) continue;
      const s = 0.35 + Math.pow(r(), 2) * 1.6;
      out.push({ x, y: terrainHeight(x, z) + s * 0.1, z, s, yaw: r() * 6, tilt: (r() - 0.5) * 0.4, tint: grey(r(), r() < 0.45) });
    }
    return out;
  }, []);
  return <Instances geometry={geo} material={mat} items={items} />;
}

function Ruins({ tex }: { tex: BoardTextures }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.stone, color: "#d9d2c0", roughness: 0.92 }), [tex]);
  const cols: { x: number; z: number; h: number; broken: boolean }[] = [
    { x: -11, z: -8.5, h: 4.4, broken: false },
    { x: 11.6, z: -7.4, h: 2.4, broken: true },
    { x: -12.8, z: 6.6, h: 1.7, broken: true },
    { x: 12.9, z: 7.8, h: 3.6, broken: false },
    { x: -13.6, z: -2.4, h: 3.1, broken: true },
  ];
  return (
    <group>
      {cols.map((c, i) => {
        const y = terrainHeight(c.x, c.z);
        return (
          <group key={i} position={[c.x, y, c.z]} rotation={[0, i * 0.7, 0]}>
            <mesh material={mat} position={[0, 0.15, 0]} raycast={() => null}>
              <boxGeometry args={[1.25, 0.4, 1.25]} />
            </mesh>
            <mesh material={mat} position={[0, 0.35 + c.h / 2, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.42, 0.5, c.h, 16]} />
            </mesh>
            {c.broken ? (
              <mesh material={mat} position={[0.1, 0.35 + c.h + 0.12, 0]} rotation={[0.35, 0, 0.5]} raycast={() => null}>
                <cylinderGeometry args={[0.36, 0.42, 0.35, 7]} />
              </mesh>
            ) : (
              <mesh material={mat} position={[0, 0.35 + c.h + 0.17, 0]} raycast={() => null}>
                <boxGeometry args={[1.1, 0.34, 1.1]} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* toppled drums */}
      {[
        [-9.6, -11.6, 0.4],
        [-8.5, -12.2, 1.2],
        [14.6, -4.2, 2.2],
      ].map(([x, z, yaw], i) => (
        <mesh key={i} material={mat} position={[x, terrainHeight(x, z) + 0.3, z]} rotation={[0, yaw, Math.PI / 2]} raycast={() => null}>
          <cylinderGeometry args={[0.42, 0.42, 1.3, 14]} />
        </mesh>
      ))}
    </group>
  );
}

function Camps() {
  const mats = useMemo(
    () => ({
      w: new THREE.MeshStandardMaterial({ color: TEAM_CLOTH.w, roughness: 0.85, flatShading: true }),
      b: new THREE.MeshStandardMaterial({ color: TEAM_CLOTH.b, roughness: 0.85, flatShading: true }),
      canvas: new THREE.MeshStandardMaterial({ color: "#e9dfc8", roughness: 0.9, flatShading: true }),
      dark: new THREE.MeshBasicMaterial({ color: "#1d140c" }),
      gold: new THREE.MeshStandardMaterial({ color: "#d9b24c", metalness: 1, roughness: 0.3 }),
      pole: new THREE.MeshStandardMaterial({ color: "#4a3420", roughness: 0.7 }),
      flag: {
        w: addWind(new THREE.MeshStandardMaterial({ map: makeBanner("w"), side: THREE.DoubleSide }), "banner", 0.2, 2),
        b: addWind(new THREE.MeshStandardMaterial({ map: makeBanner("b"), side: THREE.DoubleSide }), "banner", 0.2, 2),
      },
    }),
    [],
  );
  const flagGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.4, 2.4, 10, 16);
    g.translate(0.75, -1.2, 0);
    return g;
  }, []);
  const tents: [number, number, number][] = [
    [-7, 0, 2.1],
    [7.5, 1.5, 1.9],
    [-13, 4, 1.6],
    [13.5, 4.5, 1.7],
    [0, 7.5, 2.4],
  ];
  return (
    <group>
      {CAMPS.map((camp) => {
        const sign = Math.sign(camp.z);
        return (
          <group key={camp.z}>
            {tents.map(([tx, tz, s], i) => {
              const x = tx;
              const z = camp.z + sign * tz;
              const y = terrainHeight(x, z);
              const striped = i % 2 === 1;
              return (
                <group key={i} position={[x, y - 0.05, z]} rotation={[0, sign > 0 ? Math.PI : 0, 0]} scale={s}>
                  <mesh material={striped ? mats.canvas : mats[camp.color]} position={[0, 1.15, 0]} raycast={() => null}>
                    <coneGeometry args={[1.25, 2.3, 8]} />
                  </mesh>
                  <mesh material={striped ? mats[camp.color] : mats.canvas} position={[0, 0.25, 0]} raycast={() => null}>
                    <cylinderGeometry args={[1.25, 1.25, 0.5, 8, 1, true]} />
                  </mesh>
                  <mesh material={mats.dark} position={[0, 0.5, 1.02]} rotation={[-0.38, 0, 0]} raycast={() => null}>
                    <planeGeometry args={[0.6, 1.0]} />
                  </mesh>
                  <mesh material={mats.gold} position={[0, 2.38, 0]} raycast={() => null}>
                    <sphereGeometry args={[0.08, 8, 6]} />
                  </mesh>
                </group>
              );
            })}
            <group position={[2.6, terrainHeight(2.6, camp.z), camp.z]} rotation={[0, sign > 0 ? Math.PI : 0, 0]}>
              <mesh material={mats.pole} position={[0, 3, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.07, 0.1, 6, 8]} />
              </mesh>
              <mesh geometry={flagGeo} material={mats.flag[camp.color]} position={[0.05, 5.8, 0]} raycast={() => null} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */

export const Battlefield = memo(function Battlefield({ tex }: { tex: BoardTextures }) {
  return (
    <group>
      <WindClock />
      <SkyDome />
      <Clouds />
      <Mountains />
      <Terrain tex={tex} />
      <Meadow />
      <Dais tex={tex} />
      <Braziers tex={tex} />
      <Banners />
      <Forest />
      <Rocks />
      <Ruins tex={tex} />
      <Camps />
      <Sparkles count={110} scale={[34, 2.4, 34]} position={[0, -0.4, 0]} size={3.2} speed={0.35} opacity={0.9} color="#fff1a0" />
    </group>
  );
});
