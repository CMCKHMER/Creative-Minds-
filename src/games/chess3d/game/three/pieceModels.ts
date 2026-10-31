import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Color, PieceType } from "../types";

type Vec3 = [number, number, number];
const PI = Math.PI;
const TAU = Math.PI * 2;

export interface Parts {
  armR?: THREE.Object3D;
  weapon?: THREE.Object3D;
  slide?: THREE.Object3D;
  flag?: THREE.Object3D;
  cape?: THREE.Object3D;
  tip?: THREE.Object3D;
}

/** Resting rotations of the weapon arm (shared by the models and the animations). */
export const REST = {
  p: { armX: -0.35, armZ: 0.06, wX: 0.45, wZ: -0.06 },
  b: { armX: -0.3, armZ: 0.05, wX: 0.3, wZ: -0.05 },
  q: { armX: -0.25, armZ: 0.18, wX: 0.35, wZ: -0.18 },
  k: { armX: -0.3, armZ: 0.12, wX: 0.3, wZ: -0.12 },
} as const;

export const PIECE_HEIGHT: Record<PieceType, number> = { p: 1.05, r: 1.4, n: 1.3, b: 1.55, q: 1.72, k: 1.9 };
const PIECE_SCALE: Record<PieceType, number> = { p: 1, r: 1, n: 1, b: 1, q: 1.06, k: 1 };

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

export interface Mats {
  body: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  gem: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  fur: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  beard: THREE.MeshStandardMaterial;
}

const matCache = new Map<Color, Mats>();

export const TEAM_COLORS = {
  w: { main: "#efe7d6", accent: "#e3b74a", cloth: "#2f5fc4", spark: "#ffe08a" },
  b: { main: "#2a2730", accent: "#cfd5df", cloth: "#b3202f", spark: "#ff6a78" },
} as const;

export function getMats(color: Color): Mats {
  const cached = matCache.get(color);
  if (cached) return cached;
  const w = color === "w";
  const std = (c: string, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color: c, ...o });
  const mats: Mats = {
    body: w
      ? std("#f0e8d8", { roughness: 0.34, metalness: 0.04 })
      : std("#2a2730", { roughness: 0.26, metalness: 0.5 }),
    trim: w ? std("#e6bb4c", { roughness: 0.22, metalness: 1 }) : std("#d3d8e2", { roughness: 0.2, metalness: 1 }),
    cloth: w
      ? std("#2f5fc4", { roughness: 0.72, side: THREE.DoubleSide })
      : std("#b3202f", { roughness: 0.72, side: THREE.DoubleSide }),
    skin: std("#e5b794", { roughness: 0.55 }),
    dark: std("#17141b", { roughness: 0.4, metalness: 0.25 }),
    steel: std("#eef2f8", { roughness: 0.22, metalness: 0.65, emissive: "#3a424e", emissiveIntensity: 0.6 }),
    gem: w
      ? std("#5fd8ff", { roughness: 0.1, emissive: "#18a7d8", emissiveIntensity: 1.1 })
      : std("#ff5565", { roughness: 0.1, emissive: "#d3182c", emissiveIntensity: 1.1 }),
    hair: w ? std("#dcb86c", { roughness: 0.55 }) : std("#8e1a2b", { roughness: 0.55 }),
    fur: std("#f6f2e9", { roughness: 0.95 }),
    wood: std("#6b4423", { roughness: 0.6 }),
    beard: std("#e9e6df", { roughness: 0.9 }),
  };
  matCache.set(color, mats);
  return mats;
}

/* ------------------------------------------------------------------ */
/* Tiny modelling DSL                                                  */
/* ------------------------------------------------------------------ */

function mesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: Vec3 = [0, 0, 0],
  rot: Vec3 = [0, 0, 0],
  scl: Vec3 | number = 1,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (typeof scl === "number") m.scale.setScalar(scl);
  else m.scale.set(...scl);
  parent.add(m);
  return m;
}

/** A transform group. Giving it a `part` name keeps it separate (animatable) when baking. */
function grp(parent: THREE.Object3D, part: string | null, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.rotation.set(...rot);
  if (part) {
    g.userData.part = part;
    g.userData.dynamic = true;
  }
  parent.add(g);
  return g;
}

function marker(parent: THREE.Object3D, part: string, pos: Vec3) {
  const o = new THREE.Object3D();
  o.position.set(...pos);
  o.userData.part = part;
  o.userData.dynamic = true;
  parent.add(o);
  return o;
}

const sphere = (r: number, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt: number, rb: number, h: number, seg = 20, open = false) =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
const cone = (r: number, h: number, seg = 16) => new THREE.ConeGeometry(r, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const torus = (R: number, t: number, seg = 36, arc = TAU) => new THREE.TorusGeometry(R, t, 10, seg, arc);

function lathe(
  pts: [number, number][],
  o: { smooth?: boolean; seg?: number; phiStart?: number; phiLength?: number } = {},
) {
  const { smooth = true, seg = 44, phiStart = 0, phiLength = TAU } = o;
  let v = pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y));
  if (smooth) {
    v = new THREE.SplineCurve(v)
      .getPoints(Math.max(24, pts.length * 10))
      .map((p) => new THREE.Vector2(Math.max(p.x, 0.0005), p.y));
  }
  return new THREE.LatheGeometry(v, seg, phiStart, phiLength);
}

/** Cylinder stretched between two points (used for limbs). */
function limb(parent: THREE.Object3D, a: Vec3, b: Vec3, r1: number, r2: number, mat: THREE.Material) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 12), mat);
  m.position.copy(va).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(m);
  return m;
}

function plinth(parent: THREE.Object3D, M: Mats, r = 0.34, h = 0.1) {
  mesh(
    parent,
    lathe(
      [
        [0, 0],
        [r, 0],
        [r, 0.03],
        [r * 0.94, 0.052],
        [r * 0.86, 0.078],
        [r * 0.78, h],
        [0, h],
      ],
      { smooth: false },
    ),
    M.body,
  );
  mesh(parent, torus(r * 0.945, 0.013), M.trim, [0, 0.05, 0], [PI / 2, 0, 0]);
  mesh(parent, torus(r * 0.79, 0.011), M.trim, [0, h, 0], [PI / 2, 0, 0]);
}

/** Skin head with eyes and nose. `cy` is head centre height. */
function face(parent: THREE.Object3D, M: Mats, cy: number, R: number, zOff = 0) {
  mesh(parent, sphere(R, 28, 20), M.skin, [0, cy, zOff], [0, 0, 0], [1, 1.06, 1]);
  for (const s of [-1, 1]) {
    mesh(parent, sphere(R * 0.12, 10, 8), M.dark, [s * R * 0.38, cy + R * 0.12, zOff + R * 0.9]);
    // brows
    mesh(parent, box(R * 0.32, R * 0.05, R * 0.06), M.dark, [s * R * 0.38, cy + R * 0.3, zOff + R * 0.88], [0.25, 0, -s * 0.15]);
  }
  mesh(parent, sphere(R * 0.17, 12, 10), M.skin, [0, cy - R * 0.1, zOff + R * 0.98], [0, 0, 0], [0.8, 1.15, 1]);
  mesh(parent, box(R * 0.36, R * 0.05, R * 0.06), M.dark, [0, cy - R * 0.42, zOff + R * 0.9], [-0.15, 0, 0]);
}

/** A dome with an open face (helmet / hair cap). */
function domeCap(R: number, thetaLen: number, faceGap: number) {
  return new THREE.SphereGeometry(R, 28, 14, PI / 2 + faceGap, TAU - faceGap * 2, 0, thetaLen);
}

/* ------------------------------------------------------------------ */
/* Pawn – armoured footman with spear & shield                         */
/* ------------------------------------------------------------------ */

function buildPawn(M: Mats) {
  const root = new THREE.Group();
  plinth(root, M, 0.32, 0.09);

  for (const s of [-1, 1]) {
    mesh(root, sphere(0.062, 14, 10), M.dark, [s * 0.075, 0.125, 0.035], [0, 0, 0], [1, 0.62, 1.55]);
    mesh(root, cyl(0.04, 0.05, 0.2), M.body, [s * 0.075, 0.23, 0]);
    mesh(root, sphere(0.045, 12, 8), M.trim, [s * 0.075, 0.33, 0.02], [0, 0, 0], [1, 0.8, 1]);
  }

  // tunic, belt, cuirass
  mesh(root, lathe([[0.215, 0.26], [0.205, 0.3], [0.17, 0.4], [0.14, 0.48]]), M.cloth);
  mesh(root, torus(0.214, 0.012), M.trim, [0, 0.265, 0], [PI / 2, 0, 0]);
  mesh(root, torus(0.143, 0.02), M.dark, [0, 0.485, 0], [PI / 2, 0, 0]);
  mesh(root, box(0.05, 0.045, 0.02), M.trim, [0, 0.485, 0.147]);
  mesh(root, lathe([[0.14, 0.48], [0.155, 0.56], [0.16, 0.65], [0.14, 0.73], [0.08, 0.77]]), M.body, [0, 0, 0], [0, 0, 0], [1, 1, 0.82]);
  mesh(root, box(0.022, 0.2, 0.01), M.trim, [0, 0.62, 0.133]);
  mesh(root, box(0.1, 0.022, 0.01), M.trim, [0, 0.66, 0.133]);
  mesh(root, torus(0.088, 0.022), M.trim, [0, 0.755, 0], [PI / 2, 0, 0]);

  // head with open-face helmet
  face(root, M, 0.85, 0.088);
  mesh(root, domeCap(0.1, PI * 0.56, 0.62), M.steel, [0, 0.86, 0]);
  mesh(root, torus(0.1, 0.012), M.trim, [0, 0.86, 0], [PI / 2, 0, 0]);
  mesh(root, box(0.016, 0.075, 0.012), M.steel, [0, 0.845, 0.1]);
  mesh(root, torus(0.108, 0.018, 28, PI), M.cloth, [0, 0.86, 0], [0, PI / 2, 0], [1, 1.05, 1]);

  // left arm + round shield
  const la = grp(root, null, [-0.165, 0.71, 0], [-0.6, 0, 0]);
  mesh(la, cyl(0.034, 0.03, 0.2), M.cloth, [0, -0.1, 0]);
  mesh(la, sphere(0.036, 12, 10), M.skin, [0, -0.21, 0]);
  mesh(root, sphere(0.062, 14, 10), M.body, [-0.17, 0.72, 0], [0, 0, 0], [1, 0.8, 1]);
  const sh = grp(root, null, [-0.2, 0.56, 0.17], [0, -0.3, 0]);
  mesh(sh, cyl(0.15, 0.15, 0.03, 28), M.cloth, [0, 0, 0], [PI / 2, 0, 0]);
  mesh(sh, torus(0.15, 0.017, 32), M.trim, [0, 0, 0.012]);
  mesh(sh, sphere(0.042, 14, 10), M.trim, [0, 0, 0.02], [0, 0, 0], [1, 1, 0.5]);
  mesh(sh, box(0.028, 0.22, 0.008), M.trim, [0, 0, 0.017]);
  mesh(sh, box(0.22, 0.028, 0.008), M.trim, [0, 0, 0.017]);

  // right arm + spear (animatable)
  const armR = grp(root, "armR", [0.165, 0.71, 0], [REST.p.armX, 0, REST.p.armZ]);
  mesh(armR, cyl(0.034, 0.03, 0.2), M.cloth, [0, -0.1, 0]);
  mesh(armR, sphere(0.036, 12, 10), M.skin, [0, -0.21, 0]);
  mesh(armR, sphere(0.062, 14, 10), M.body, [0, 0.01, 0], [0, 0, 0], [1, 0.8, 1]);
  const weapon = grp(armR, "weapon", [0, -0.21, 0], [REST.p.wX, 0, REST.p.wZ]);
  const slide = grp(weapon, "slide");
  mesh(slide, cyl(0.014, 0.014, 0.58), M.wood, [0, 0.14, 0]);
  mesh(slide, cone(0.036, 0.15, 4), M.steel, [0, 0.5, 0], [0, PI / 4, 0], [1, 1, 0.45]);
  mesh(slide, cyl(0.022, 0.022, 0.025), M.trim, [0, 0.42, 0]);
  mesh(slide, cone(0.035, 0.09), M.cloth, [0, 0.37, 0], [PI, 0, 0]);
  mesh(slide, cone(0.014, 0.06), M.trim, [0, -0.17, 0], [PI, 0, 0]);
  return root;
}

/* ------------------------------------------------------------------ */
/* Rook – bastion tower with gate, arrow slits and banner              */
/* ------------------------------------------------------------------ */

function buildRook(M: Mats) {
  const root = new THREE.Group();
  plinth(root, M, 0.38, 0.1);

  mesh(root, lathe([[0.35, 0.1], [0.315, 0.3], [0.275, 0.7], [0.262, 0.85]]), M.body);
  for (const [y, r] of [[0.31, 0.314], [0.56, 0.292], [0.8, 0.268]] as const) {
    mesh(root, torus(r, 0.011), M.trim, [0, y, 0], [PI / 2, 0, 0]);
  }
  // corbelled parapet
  mesh(root, lathe([[0.262, 0.85], [0.285, 0.88], [0.33, 0.94], [0.335, 1.06]]), M.body);
  mesh(root, torus(0.322, 0.014), M.trim, [0, 0.935, 0], [PI / 2, 0, 0]);
  mesh(root, cyl(0.325, 0.325, 0.03, 32), M.dark, [0, 1.055, 0]);
  mesh(root, torus(0.335, 0.012), M.trim, [0, 1.07, 0], [PI / 2, 0, 0]);

  // merlons
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const g = grp(root, null, [Math.sin(a) * 0.3, 1.15, Math.cos(a) * 0.3], [0, a, 0]);
    mesh(g, box(0.15, 0.15, 0.085), M.body);
    mesh(g, box(0.165, 0.025, 0.1), M.trim, [0, 0.085, 0]);
  }

  // gate
  mesh(root, box(0.17, 0.24, 0.05), M.dark, [0, 0.27, 0.318]);
  mesh(root, cyl(0.085, 0.085, 0.05, 20), M.dark, [0, 0.39, 0.318], [PI / 2, 0, 0]);
  mesh(root, torus(0.098, 0.013, 24, PI), M.trim, [0, 0.39, 0.34]);
  for (const s of [-1, 1]) mesh(root, box(0.016, 0.26, 0.02), M.trim, [s * 0.097, 0.27, 0.34]);
  for (const x of [-0.04, 0, 0.04]) mesh(root, box(0.01, 0.34, 0.012), M.trim, [x, 0.31, 0.347]);
  mesh(root, box(0.17, 0.012, 0.012), M.trim, [0, 0.3, 0.347]);

  // windows & arrow slits
  const slit = (a: number, y: number, h: number) => {
    const g = grp(root, null, [Math.sin(a) * 0.268, y, Math.cos(a) * 0.268], [0, a, 0]);
    mesh(g, box(0.04, h, 0.04), M.dark);
    mesh(g, box(0.062, 0.014, 0.03), M.trim, [0, h / 2 + 0.01, 0.004]);
  };
  slit(0, 0.66, 0.15);
  slit(1.15, 0.6, 0.16);
  slit(-1.15, 0.6, 0.16);
  slit(2.2, 0.6, 0.16);
  slit(-2.2, 0.6, 0.16);
  slit(PI, 0.6, 0.16);

  // banner
  mesh(root, cyl(0.012, 0.012, 0.36), M.trim, [0, 1.22, 0]);
  mesh(root, sphere(0.024, 12, 10), M.trim, [0, 1.41, 0]);
  const flag = grp(root, "flag", [0, 1.33, 0]);
  const pennant = new THREE.Shape();
  pennant.moveTo(0, 0.07);
  pennant.lineTo(0.27, 0.0);
  pennant.lineTo(0, -0.07);
  pennant.lineTo(0.03, 0.0);
  pennant.lineTo(0, 0.07);
  mesh(flag, new THREE.ShapeGeometry(pennant), M.cloth, [0.012, 0, 0]);
  return root;
}

/* ------------------------------------------------------------------ */
/* Knight – armoured war-horse                                         */
/* ------------------------------------------------------------------ */

const HORSE_PROFILE: [number, number][] = [
  [-0.26, 0.0],
  [-0.3, 0.18],
  [-0.3, 0.38],
  [-0.26, 0.58],
  [-0.18, 0.74],
  [-0.1, 0.86],
  [-0.02, 0.92],
  [0.08, 0.9],
  [0.18, 0.82],
  [0.3, 0.68],
  [0.4, 0.55],
  [0.45, 0.47],
  [0.44, 0.4],
  [0.38, 0.36],
  [0.28, 0.4],
  [0.2, 0.47],
  [0.12, 0.5],
  [0.06, 0.45],
  [0.08, 0.32],
  [0.14, 0.18],
  [0.2, 0.06],
  [0.18, 0.0],
];

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function horseGeometry() {
  const shape = new THREE.Shape();
  const pts = HORSE_PROFILE.map(([x, y]) => new THREE.Vector2(x, y));
  shape.moveTo(pts[0].x, pts[0].y);
  shape.splineThru(pts.slice(1));
  shape.lineTo(pts[0].x, pts[0].y);

  let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.035,
    bevelSegments: 5,
    curveSegments: 40,
  });
  geo.translate(0, 0, -0.1);

  // taper: thick neck, narrower head, slim muzzle
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const wy = smoothstep(0.3, 0.62, y);
    const wx = smoothstep(0.1, 0.32, x) * smoothstep(0.25, 0.45, y);
    const k = (1 - wy * 0.38) * (1 - wx * 0.42);
    pos.setZ(i, pos.getZ(i) * k);
  }
  geo.deleteAttribute("uv");
  geo.deleteAttribute("normal");
  geo = mergeVertices(geo, 1e-4);
  geo.computeVertexNormals();
  return geo;
}

function buildKnight(M: Mats) {
  const root = new THREE.Group();
  plinth(root, M, 0.37, 0.1);

  // caparison (horse armour cloth) over the chest
  mesh(root, lathe([[0.33, 0.1], [0.3, 0.2], [0.26, 0.3], [0.22, 0.4]]), M.cloth);
  mesh(root, torus(0.325, 0.016), M.trim, [0, 0.12, 0], [PI / 2, 0, 0]);
  mesh(root, torus(0.255, 0.012), M.trim, [0, 0.3, 0], [PI / 2, 0, 0]);
  mesh(root, torus(0.225, 0.02), M.trim, [0, 0.4, 0], [PI / 2, 0, 0]);

  const horse = grp(root, null, [0, 0.33, -0.07], [0, -PI / 2, 0]);
  horse.scale.setScalar(1.02);
  mesh(horse, horseGeometry(), M.body);

  // mane along the back of the neck
  const manePts: [number, number, number][] = [
    [-0.325, 0.16, 0.2],
    [-0.335, 0.34, 0.1],
    [-0.31, 0.52, 0.0],
    [-0.245, 0.67, -0.25],
    [-0.16, 0.8, -0.45],
    [-0.08, 0.9, -0.6],
    [-0.0, 0.97, -0.75],
  ];
  manePts.forEach(([x, y, rz], i) => {
    mesh(horse, sphere(0.06, 12, 10), M.hair, [x, y, 0], [0, 0, rz], [0.7, 1.9 - i * 0.05, 0.85 - i * 0.03]);
  });
  // forelock
  mesh(horse, sphere(0.05, 12, 10), M.hair, [0.1, 0.9, 0], [0, 0, -1.0], [0.6, 1.6, 0.6]);

  // ears
  for (const s of [-1, 1]) {
    mesh(horse, cone(0.034, 0.15, 12), M.body, [-0.045, 0.99, s * 0.045], [s * 0.18, 0, -0.28]);
    mesh(horse, cone(0.02, 0.1, 10), M.skin, [-0.035, 0.985, s * 0.052], [s * 0.18, 0, -0.28]);
  }
  // eyes
  for (const s of [-1, 1]) {
    mesh(horse, sphere(0.028, 12, 10), M.dark, [0.11, 0.7, s * 0.07]);
    mesh(horse, sphere(0.008, 6, 6), M.fur, [0.118, 0.708, s * 0.092]);
    // nostrils
    mesh(horse, sphere(0.014, 8, 6), M.dark, [0.435, 0.47, s * 0.032], [0, 0, 0], [1, 1.3, 0.8]);
    // cheek rosette
    mesh(horse, cyl(0.04, 0.04, 0.012, 16), M.trim, [0.06, 0.58, s * 0.087], [PI / 2, 0, 0]);
    mesh(horse, sphere(0.014, 8, 8), M.gem, [0.06, 0.58, s * 0.095]);
  }
  // bridle: noseband & browband
  mesh(horse, torus(0.062, 0.011, 20), M.cloth, [0.33, 0.58, 0], [0, PI / 2, 0.88], [1, 1.25, 1]);
  mesh(horse, torus(0.067, 0.009, 20), M.trim, [0.1, 0.8, 0], [0, PI / 2, 0.7], [1, 1.2, 1]);
  mesh(horse, sphere(0.022, 10, 8), M.gem, [0.115, 0.815, 0]);
  // plume on the poll
  mesh(horse, cone(0.045, 0.22, 12), M.cloth, [-0.12, 1.02, 0], [0, 0, 0.95]);
  mesh(horse, sphere(0.035, 10, 8), M.trim, [-0.065, 0.94, 0]);
  return root;
}

/* ------------------------------------------------------------------ */
/* Bishop – robed prelate with mitre and crozier                       */
/* ------------------------------------------------------------------ */

function buildBishop(M: Mats) {
  const root = new THREE.Group();
  plinth(root, M, 0.34, 0.09);

  const robe: [number, number][] = [[0.31, 0.09], [0.29, 0.2], [0.235, 0.42], [0.19, 0.7], [0.165, 0.88], [0.16, 0.98]];
  mesh(root, lathe(robe), M.body);
  mesh(root, torus(0.303, 0.015), M.trim, [0, 0.12, 0], [PI / 2, 0, 0]);
  const stole = robe.slice(1).map(([r, y]) => [r + 0.012, y] as [number, number]);
  mesh(root, lathe(stole, { phiStart: -0.3, phiLength: 0.6 }), M.cloth);
  mesh(root, lathe(stole, { phiStart: PI - 0.3, phiLength: 0.6 }), M.cloth);
  mesh(root, box(0.02, 0.17, 0.006), M.trim, [0, 0.52, 0.232]);
  mesh(root, box(0.085, 0.02, 0.006), M.trim, [0, 0.56, 0.232]);
  mesh(root, torus(0.17, 0.014), M.trim, [0, 0.9, 0], [PI / 2, 0, 0]);

  // mozzetta (shoulder cape)
  mesh(root, lathe([[0.1, 1.08], [0.2, 1.03], [0.255, 0.94], [0.265, 0.85]]), M.cloth);
  mesh(root, torus(0.263, 0.013), M.trim, [0, 0.85, 0], [PI / 2, 0, 0]);
  mesh(root, torus(0.115, 0.016), M.trim, [0, 1.07, 0], [PI / 2, 0, 0]);
  mesh(root, cyl(0.048, 0.055, 0.09), M.skin, [0, 1.1, 0]);

  // head, beard, mitre
  face(root, M, 1.19, 0.093);
  mesh(root, sphere(0.062, 14, 12), M.beard, [0, 1.12, 0.055], [0, 0, 0], [1.05, 1.25, 0.8]);
  mesh(root, lathe([[0.1, 1.26], [0.11, 1.33], [0.088, 1.43], [0.0, 1.55]]), M.body, [0, 0, 0], [0, 0, 0], [1, 1, 0.56]);
  mesh(root, torus(0.103, 0.015), M.trim, [0, 1.265, 0], [PI / 2, 0, 0], [1, 0.56, 1]);
  mesh(root, sphere(0.015, 10, 8), M.gem, [0, 1.28, 0.062]);
  mesh(root, box(0.022, 0.2, 0.012), M.trim, [0, 1.4, 0.052], [-0.28, 0, 0]);
  mesh(root, sphere(0.018, 10, 8), M.trim, [0, 1.56, 0]);
  for (const s of [-1, 1]) mesh(root, box(0.035, 0.14, 0.008), M.cloth, [s * 0.035, 1.14, -0.1], [0.15, 0, s * 0.05]);

  // left arm holding a book
  limb(root, [-0.2, 0.94, 0], [-0.07, 0.78, 0.19], 0.05, 0.055, M.body);
  mesh(root, sphere(0.038, 12, 10), M.skin, [-0.06, 0.78, 0.205]);
  mesh(root, box(0.11, 0.03, 0.08), M.cloth, [-0.03, 0.82, 0.22], [0.5, 0.2, 0]);
  mesh(root, box(0.1, 0.012, 0.07), M.fur, [-0.03, 0.822, 0.222], [0.5, 0.2, 0]);

  // right arm + crozier
  const armR = grp(root, "armR", [0.2, 0.94, 0], [REST.b.armX, 0, REST.b.armZ]);
  limb(armR, [0, 0, 0], [0, -0.3, 0], 0.05, 0.06, M.body);
  mesh(armR, sphere(0.04, 12, 10), M.skin, [0, -0.31, 0]);
  const weapon = grp(armR, "weapon", [0, -0.3, 0], [REST.b.wX, 0, REST.b.wZ]);
  const slide = grp(weapon, "slide");
  mesh(slide, cyl(0.013, 0.016, 1.2), M.wood, [0, 0.15, 0]);
  mesh(slide, cyl(0.02, 0.02, 0.05), M.trim, [0, 0.0, 0]);
  mesh(slide, cyl(0.02, 0.02, 0.04), M.trim, [0, 0.72, 0]);
  mesh(slide, torus(0.07, 0.014, 24, PI * 1.5), M.trim, [0, 0.8, 0], [0, -PI / 2, 0]);
  mesh(slide, sphere(0.024, 12, 10), M.gem, [0, 0.8, 0.07]);
  marker(slide, "tip", [0, 0.8, 0.03]);
  return root;
}

/* ------------------------------------------------------------------ */
/* Queen – crowned duellist                                            */
/* ------------------------------------------------------------------ */

function buildQueen(M: Mats) {
  const root = new THREE.Group();
  plinth(root, M, 0.36, 0.09);

  const gown: [number, number][] = [[0.34, 0.09], [0.32, 0.15], [0.26, 0.35], [0.19, 0.58], [0.125, 0.8], [0.105, 0.9]];
  mesh(root, lathe(gown), M.body);
  mesh(root, torus(0.332, 0.016), M.trim, [0, 0.12, 0], [PI / 2, 0, 0]);
  const overlay = gown.slice(1).map(([r, y]) => [r + 0.012, y] as [number, number]);
  mesh(root, lathe(overlay, { phiStart: -0.42, phiLength: 0.84 }), M.cloth);
  mesh(root, lathe(overlay, { phiStart: PI - 0.42, phiLength: 0.84 }), M.cloth);
  // gems down the front
  for (const [y, r] of [[0.3, 0.272], [0.46, 0.226], [0.62, 0.178]] as const) {
    mesh(root, sphere(0.016, 10, 8), M.gem, [0, y, r + 0.008]);
  }
  // bodice
  mesh(root, lathe([[0.112, 0.88], [0.132, 1.0], [0.14, 1.09], [0.108, 1.17]]), M.cloth);
  mesh(root, torus(0.114, 0.018), M.trim, [0, 0.9, 0], [PI / 2, 0, 0]);
  mesh(root, torus(0.12, 0.012), M.trim, [0, 1.17, 0], [PI / 2, 0, 0], [1.2, 1, 0.8]);
  // shoulders / neck
  mesh(root, sphere(0.115, 20, 14), M.skin, [0, 1.18, 0], [0, 0, 0], [1.3, 0.42, 0.75]);
  mesh(root, cyl(0.036, 0.045, 0.11), M.skin, [0, 1.25, 0]);
  mesh(root, torus(0.045, 0.01), M.trim, [0, 1.235, 0], [PI / 2, 0, 0]);
  mesh(root, sphere(0.014, 8, 8), M.gem, [0, 1.225, 0.046]);

  // head & hair
  face(root, M, 1.35, 0.085);
  mesh(root, domeCap(0.093, PI * 0.62, 0.9), M.hair, [0, 1.37, 0]);
  mesh(root, sphere(0.09, 16, 14), M.hair, [0, 1.3, -0.05], [0, 0, 0], [1, 1.1, 0.75]);
  mesh(root, sphere(0.09, 16, 14), M.hair, [0, 1.15, -0.1], [0.2, 0, 0], [0.95, 2.6, 0.55]);
  mesh(root, sphere(0.014, 8, 6), M.gem, [0.086, 1.32, 0.0]);
  mesh(root, sphere(0.014, 8, 6), M.gem, [-0.086, 1.32, 0.0]);
  // lips
  mesh(root, sphere(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: "#c0505a", roughness: 0.4 }), [0, 1.318, 0.08], [0, 0, 0], [1.8, 0.7, 0.8]);

  // crown
  mesh(root, torus(0.095, 0.017), M.trim, [0, 1.435, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const tall = i % 2 === 0;
    const h = tall ? 0.115 : 0.08;
    const g = grp(root, null, [Math.sin(a) * 0.095, 1.44 + h / 2, Math.cos(a) * 0.095]);
    mesh(g, cone(0.017, h, 10), M.trim);
    mesh(g, sphere(0.014, 8, 8), M.gem, [0, h / 2 + 0.006, 0]);
  }
  mesh(root, sphere(0.022, 10, 8), M.gem, [0, 1.435, 0.105]);

  // left arm: hand on the hip
  limb(root, [-0.15, 1.15, 0], [-0.21, 0.97, 0.06], 0.036, 0.04, M.cloth);
  limb(root, [-0.21, 0.97, 0.06], [-0.14, 0.88, 0.14], 0.034, 0.03, M.skin);
  mesh(root, sphere(0.032, 10, 8), M.skin, [-0.13, 0.875, 0.15]);

  // right arm + rapier
  const armR = grp(root, "armR", [0.15, 1.15, 0], [REST.q.armX, 0, REST.q.armZ]);
  limb(armR, [0, 0, 0], [0, -0.28, 0], 0.036, 0.045, M.cloth);
  mesh(armR, sphere(0.034, 10, 8), M.skin, [0, -0.29, 0]);
  const weapon = grp(armR, "weapon", [0, -0.29, 0], [REST.q.wX, 0, REST.q.wZ]);
  const slide = grp(weapon, "slide");
  mesh(slide, box(0.016, 0.64, 0.005), M.steel, [0, 0.46, 0]);
  mesh(slide, cone(0.0113, 0.06, 4), M.steel, [0, 0.81, 0], [0, PI / 4, 0], [1, 1, 0.35]);
  mesh(slide, cyl(0.05, 0.028, 0.03, 16), M.trim, [0, 0.12, 0]);
  mesh(slide, box(0.13, 0.012, 0.012), M.trim, [0, 0.145, 0]);
  mesh(slide, cyl(0.011, 0.011, 0.14), M.dark, [0, 0.02, 0]);
  mesh(slide, sphere(0.022, 10, 8), M.gem, [0, -0.06, 0]);
  return root;
}

/* ------------------------------------------------------------------ */
/* King – crowned monarch with sword, orb and cape                     */
/* ------------------------------------------------------------------ */

function buildKing(M: Mats) {
  const root = new THREE.Group();
  plinth(root, M, 0.39, 0.1);

  const robe: [number, number][] = [[0.37, 0.1], [0.35, 0.16], [0.29, 0.4], [0.235, 0.7], [0.215, 0.95], [0.225, 1.08], [0.17, 1.18], [0.1, 1.24]];
  mesh(root, lathe(robe), M.body);
  mesh(root, torus(0.36, 0.036, 36), M.fur, [0, 0.14, 0], [PI / 2, 0, 0], [1, 1, 0.8]);
  const tabard = robe.slice(1, 6).map(([r, y]) => [r + 0.014, y] as [number, number]);
  mesh(root, lathe(tabard, { phiStart: -0.4, phiLength: 0.8 }), M.cloth);
  mesh(root, box(0.03, 0.24, 0.008), M.trim, [0, 0.55, 0.262]);
  mesh(root, box(0.13, 0.03, 0.008), M.trim, [0, 0.62, 0.262]);
  mesh(root, torus(0.234, 0.024), M.dark, [0, 0.8, 0], [PI / 2, 0, 0]);
  mesh(root, box(0.07, 0.06, 0.022), M.trim, [0, 0.8, 0.235]);
  mesh(root, sphere(0.015, 8, 8), M.gem, [0, 0.8, 0.248]);

  // ermine shoulder collar
  mesh(root, torus(0.19, 0.058, 30), M.fur, [0, 1.14, 0], [PI / 2, 0, 0], [1, 1, 0.65]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    mesh(root, sphere(0.012, 6, 6), M.dark, [Math.sin(a) * 0.19, 1.15, Math.cos(a) * 0.19 + 0.0], [0, 0, 0], [1, 0.6, 1.8]);
  }
  mesh(root, cyl(0.05, 0.06, 0.12), M.skin, [0, 1.25, 0]);

  // head
  face(root, M, 1.38, 0.098);
  mesh(root, domeCap(0.106, PI * 0.58, 0.85), beardMat(M), [0, 1.395, 0]);
  mesh(root, sphere(0.085, 16, 14), beardMat(M), [0, 1.3, 0.055], [0, 0, 0], [1, 1.2, 0.75]);
  mesh(root, sphere(0.03, 10, 8), beardMat(M), [0.032, 1.345, 0.098], [0, 0, 0.5], [1.5, 0.6, 0.7]);
  mesh(root, sphere(0.03, 10, 8), beardMat(M), [-0.032, 1.345, 0.098], [0, 0, -0.5], [1.5, 0.6, 0.7]);

  // crown with arches, orb and cross
  mesh(root, torus(0.108, 0.02), M.trim, [0, 1.46, 0], [PI / 2, 0, 0]);
  mesh(root, cyl(0.108, 0.108, 0.04, 24, true), M.trim, [0, 1.48, 0]);
  mesh(root, new THREE.SphereGeometry(0.104, 24, 12, 0, TAU, 0, PI / 2), M.cloth, [0, 1.485, 0], [0, 0, 0], [1, 0.95, 1]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const g = grp(root, null, [Math.sin(a) * 0.108, 1.5, Math.cos(a) * 0.108]);
    mesh(g, cone(0.02, 0.085, 10), M.trim);
    mesh(g, sphere(0.014, 8, 8), M.gem, [0, 0.05, 0]);
  }
  mesh(root, torus(0.108, 0.011, 28, PI), M.trim, [0, 1.49, 0]);
  mesh(root, torus(0.108, 0.011, 28, PI), M.trim, [0, 1.49, 0], [0, PI / 2, 0]);
  mesh(root, sphere(0.027, 12, 10), M.trim, [0, 1.6, 0]);
  mesh(root, box(0.014, 0.07, 0.014), M.trim, [0, 1.655, 0]);
  mesh(root, box(0.05, 0.014, 0.014), M.trim, [0, 1.67, 0]);

  // cape (swaying)
  const cape = grp(root, "cape", [0, 1.2, 0]);
  const capePts = ([[0.43, 0.1], [0.4, 0.16], [0.34, 0.4], [0.28, 0.7], [0.262, 0.95], [0.27, 1.08], [0.2, 1.18]] as [number, number][]).map(
    ([r, y]) => [r, y - 1.2] as [number, number],
  );
  mesh(cape, lathe(capePts, { phiStart: PI - 1.25, phiLength: 2.5 }), M.cloth, [0, 0, 0]);

  // left arm holding the orb
  limb(root, [-0.22, 1.13, 0], [-0.18, 0.9, 0.17], 0.052, 0.05, M.cloth);
  mesh(root, sphere(0.04, 12, 10), M.skin, [-0.17, 0.88, 0.19]);
  mesh(root, sphere(0.068, 20, 16), M.trim, [-0.15, 0.97, 0.24]);
  mesh(root, torus(0.068, 0.008, 24), M.dark, [-0.15, 0.97, 0.24], [PI / 2, 0, 0]);
  mesh(root, box(0.012, 0.05, 0.012), M.trim, [-0.15, 1.062, 0.24]);
  mesh(root, box(0.036, 0.012, 0.012), M.trim, [-0.15, 1.068, 0.24]);

  // right arm + sword
  const armR = grp(root, "armR", [0.22, 1.13, 0], [REST.k.armX, 0, REST.k.armZ]);
  limb(armR, [0, 0, 0], [0, -0.3, 0], 0.052, 0.06, M.cloth);
  mesh(armR, sphere(0.04, 12, 10), M.skin, [0, -0.31, 0]);
  mesh(armR, sphere(0.062, 14, 10), M.fur, [0, 0.01, 0], [0, 0, 0], [1, 0.8, 1]);
  const weapon = grp(armR, "weapon", [0, -0.3, 0], [REST.k.wX, 0, REST.k.wZ]);
  const slide = grp(weapon, "slide");
  mesh(slide, box(0.05, 0.62, 0.012), M.steel, [0, 0.48, 0]);
  mesh(slide, cone(0.0354, 0.1, 4), M.steel, [0, 0.84, 0], [0, PI / 4, 0], [1, 1, 0.34]);
  mesh(slide, box(0.012, 0.5, 0.014), M.dark, [0, 0.45, 0]);
  mesh(slide, box(0.18, 0.026, 0.032), M.trim, [0, 0.165, 0]);
  for (const s of [-1, 1]) mesh(slide, sphere(0.02, 10, 8), M.trim, [s * 0.09, 0.165, 0]);
  mesh(slide, cyl(0.014, 0.014, 0.14), M.dark, [0, 0.08, 0]);
  mesh(slide, sphere(0.03, 12, 10), M.gem, [0, -0.01, 0]);
  return root;
}

const kingHairCache = new Map<Mats, THREE.MeshStandardMaterial>();
function beardMat(M: Mats) {
  let m = kingHairCache.get(M);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: "#5d3d22", roughness: 0.85 });
    kingHairCache.set(M, m);
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Baking: merge static meshes by material, keep animated groups       */
/* ------------------------------------------------------------------ */

function bake(container: THREE.Object3D) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keepers: THREE.Object3D[] = [];

  const collect = (node: THREE.Object3D, parentMatrix: THREE.Matrix4) => {
    for (const child of node.children) {
      child.updateMatrix();
      const m = parentMatrix.clone().multiply(child.matrix);
      if (child.userData.dynamic) {
        keepers.push(child);
        continue;
      }
      const asMesh = child as THREE.Mesh;
      if (asMesh.isMesh) {
        const g = asMesh.geometry.clone();
        g.applyMatrix4(m);
        const key = asMesh.material as THREE.Material;
        const list = buckets.get(key) ?? [];
        list.push(g);
        buckets.set(key, list);
      }
      collect(child, m);
    }
  };
  collect(container, new THREE.Matrix4());
  container.clear();

  for (const [mat, geos] of buckets) {
    const prepared = geos.map((g) => {
      const ng = g.index ? g.toNonIndexed() : g;
      for (const name of Object.keys(ng.attributes)) {
        if (name !== "position" && name !== "normal") ng.deleteAttribute(name);
      }
      return ng;
    });
    const merged = mergeGeometries(prepared, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    container.add(m);
  }
  for (const k of keepers) {
    container.add(k);
    bake(k);
  }
}

/* ------------------------------------------------------------------ */
/* Public factory                                                      */
/* ------------------------------------------------------------------ */

const protoCache = new Map<string, THREE.Group>();

function buildProto(type: PieceType, color: Color): THREE.Group {
  const M = getMats(color);
  const builders: Record<PieceType, (m: Mats) => THREE.Group> = {
    p: buildPawn,
    r: buildRook,
    n: buildKnight,
    b: buildBishop,
    q: buildQueen,
    k: buildKing,
  };
  const root = builders[type](M);
  bake(root);
  root.scale.setScalar(PIECE_SCALE[type]);
  return root;
}

export interface PieceInstance {
  root: THREE.Group;
  parts: Parts;
}

export function createPiece(type: PieceType, color: Color): PieceInstance {
  const key = `${type}${color}`;
  let proto = protoCache.get(key);
  if (!proto) {
    proto = buildProto(type, color);
    protoCache.set(key, proto);
  }
  const root = proto.clone(true);
  const parts: Parts = {};
  root.traverse((o) => {
    const n = o.userData.part as keyof Parts | undefined;
    if (n) parts[n] = o;
  });
  return { root, parts };
}

/* ------------------------------------------------------------------ */
/* Click targets that follow each figure's visible silhouette          */
/* ------------------------------------------------------------------ */

const hitCache = new Map<PieceType, THREE.BufferGeometry>();

/**
 * Invisible lathe "shrink-wrap" of a piece: for every height slice it keeps the widest
 * radius of the real model. Tall pieces in front no longer swallow clicks meant for the
 * pieces behind them, and it is far cheaper to raycast than the detailed meshes.
 */
export function pieceHitGeometry(type: PieceType): THREE.BufferGeometry {
  const cached = hitCache.get(type);
  if (cached) return cached;

  const { root } = createPiece(type, "w");
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let maxY = 0.1;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y > maxY) maxY = v.y;
    }
  });

  const bins = 28;
  const prof = new Array<number>(bins).fill(0);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const bin = Math.min(bins - 1, Math.max(0, Math.floor((v.y / maxY) * bins)));
      const r = Math.hypot(v.x, v.z);
      if (r > prof[bin]) prof[bin] = r;
    }
  });
  // close small gaps between slices, keep thin parts (spears, crowns) clickable
  const smoothed = prof.map((r, i) => Math.min(0.4, Math.max(0.15, r, (prof[i - 1] ?? 0) * 0.85, (prof[i + 1] ?? 0) * 0.85)));

  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0)];
  for (let i = 0; i < bins; i++) {
    const y0 = (i / bins) * maxY;
    const y1 = ((i + 1) / bins) * maxY;
    pts.push(new THREE.Vector2(smoothed[i], y0), new THREE.Vector2(smoothed[i], y1));
  }
  pts.push(new THREE.Vector2(0.0001, maxY));
  const geo = new THREE.LatheGeometry(pts, 14);
  hitCache.set(type, geo);
  return geo;
}
