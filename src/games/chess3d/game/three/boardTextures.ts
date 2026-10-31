import * as THREE from "three";
import { rng } from "./environment/noise";

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function toTexture(c: HTMLCanvasElement, repeat = true) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function grain(ctx: Ctx, r: () => number, size: number, count: number, alpha: number) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = r() > 0.5 ? "#ffffff" : "#000000";
    const s = 1 + r() * 1.6;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

function blotches(ctx: Ctx, r: () => number, size: number, count: number, colors: string[], alpha: number, minR: number, maxR: number) {
  for (let i = 0; i < count; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = minR + r() * (maxR - minR);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, colors[i % colors.length]);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.globalAlpha = 1;
}

function crack(ctx: Ctx, r: () => number, size: number, dark: string, light: string) {
  let x = r() * size;
  let y = r() * size;
  let a = r() * Math.PI * 2;
  const pts: [number, number][] = [[x, y]];
  const steps = 8 + Math.floor(r() * 14);
  for (let i = 0; i < steps; i++) {
    a += (r() - 0.5) * 1.1;
    x += Math.cos(a) * size * 0.045;
    y += Math.sin(a) * size * 0.045;
    pts.push([x, y]);
  }
  const draw = (dx: number, dy: number, color: string, w: number, alpha: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (const [px, py] of pts) ctx.lineTo(px + dx, py + dy);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.globalAlpha = alpha;
    ctx.stroke();
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(1, 1, light, 1.2, 0.25);
  draw(0, 0, dark, 1.1 + r() * 0.9, 0.55);
  ctx.globalAlpha = 1;
}

/** Moss creeping in from a point near the tile edge. */
function moss(ctx: Ctx, r: () => number, cx: number, cy: number, spread: number, alpha: number) {
  const greens = ["#4e6e22", "#5f8229", "#6f9332", "#3f5c1c", "#7fa23a"];
  for (let i = 0; i < 70; i++) {
    const ang = r() * Math.PI * 2;
    const dist = Math.pow(r(), 0.7) * spread;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const rad = (1 - dist / spread) * 9 + 2 + r() * 4;
    ctx.globalAlpha = alpha * (0.45 + r() * 0.55);
    ctx.fillStyle = greens[Math.floor(r() * greens.length)];
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha * 0.8;
  for (let i = 0; i < 40; i++) {
    const ang = r() * Math.PI * 2;
    const dist = r() * spread * 0.9;
    ctx.fillStyle = r() > 0.5 ? "#a6c45a" : "#2f4614";
    ctx.fillRect(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function edgeShade(ctx: Ctx, size: number, alpha: number) {
  const w = size * 0.06;
  const sides: [number, number, number, number, number, number, number, number][] = [
    [0, 0, 0, w, 0, 0, size, w],
    [0, size, 0, size - w, 0, size - w, size, w],
    [0, 0, w, 0, 0, 0, w, size],
    [size, 0, size - w, 0, size - w, 0, w, size],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of sides) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}

/**
 * Engraved compass emblem centred on the shared corner of the four central squares.
 * `corner` is the canvas corner that touches the board centre.
 */
function emblem(ctx: Ctx, size: number, corner: [number, number], dark: boolean) {
  const [cx, cy] = corner;
  const line = dark ? "rgba(10,14,12,0.75)" : "rgba(70,52,28,0.6)";
  const glow = dark ? "rgba(214,182,96,0.55)" : "rgba(160,120,40,0.45)";
  const hi = "rgba(255,248,220,0.35)";
  const stroke = (fn: () => void, color: string, w: number, dx = 0, dy = 0) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.beginPath();
    fn();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  };
  const rings = [size * 0.92, size * 0.84, size * 0.5, size * 0.42];
  for (const rad of rings) {
    stroke(() => ctx.arc(cx, cy, rad, 0, Math.PI * 2), hi, 3, 1.5, 1.5);
    stroke(() => ctx.arc(cx, cy, rad, 0, Math.PI * 2), line, 3);
  }
  stroke(() => ctx.arc(cx, cy, size * 0.88, 0, Math.PI * 2), glow, 2);
  // runic ticks between the outer rings
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r0 = size * (i % 4 === 0 ? 0.845 : 0.86);
    const r1 = size * 0.915;
    stroke(() => {
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }, line, i % 4 === 0 ? 2.5 : 1.4);
  }
  // eight-point star
  const star = () => {
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? (i % 4 === 0 ? size * 0.8 : size * 0.6) : size * 0.2;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  stroke(star, hi, 3, 1.5, 1.5);
  stroke(star, line, 3);
  ctx.save();
  ctx.beginPath();
  star();
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.restore();
}

export function makeStoneTile(dark: boolean, seed: number, emblemCorner?: [number, number]) {
  const size = 256;
  const r = rng(seed * 7919 + (dark ? 13 : 3));
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  if (dark) {
    g.addColorStop(0, "#47534f");
    g.addColorStop(1, "#38423f");
  } else {
    g.addColorStop(0, "#ddcba3");
    g.addColorStop(1, "#cdb88d");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  blotches(ctx, r, size, 22, dark ? ["#5f6b66", "#2b3331", "#4d5a4a"] : ["#efe0bd", "#b9a275", "#d4bf92"], 0.22, 20, 70);
  grain(ctx, r, size, 2200, 0.07);
  if (emblemCorner) emblem(ctx, size, emblemCorner, dark);
  const cracks = Math.floor(r() * 3);
  for (let i = 0; i < cracks; i++) crack(ctx, r, size, dark ? "#151a19" : "#6d5a3a", dark ? "#7b8781" : "#fff2d4");
  // chipped corners
  for (let i = 0; i < 4; i++) {
    if (r() < 0.35) {
      const x = i % 2 ? size : 0;
      const y = i < 2 ? 0 : size;
      ctx.fillStyle = dark ? "rgba(10,14,12,0.45)" : "rgba(90,70,40,0.35)";
      ctx.beginPath();
      ctx.arc(x, y, 6 + r() * 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // moss patches creeping from edges and corners
  const patches = emblemCorner ? 0 : r() < 0.25 ? 0 : 1 + Math.floor(r() * 2.4);
  for (let i = 0; i < patches; i++) {
    const side = Math.floor(r() * 4);
    const t = r() * size;
    const inset = r() * 20;
    const [mx, my] = side === 0 ? [t, inset] : side === 1 ? [size - inset, t] : side === 2 ? [t, size - inset] : [inset, t];
    moss(ctx, r, mx, my, 30 + r() * 45, dark ? 0.85 : 0.7);
  }
  edgeShade(ctx, size, dark ? 0.45 : 0.3);
  return toTexture(c, false);
}

function makeCurbStone() {
  const size = 256;
  const r = rng(91);
  const { c, ctx } = canvas(size);
  ctx.fillStyle = "#8a8578";
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, r, size, 30, ["#a39d8d", "#6b675c", "#7f7a68"], 0.3, 15, 60);
  grain(ctx, r, size, 3000, 0.09);
  for (let i = 0; i < 4; i++) crack(ctx, r, size, "#3e3b33", "#c8c2b0");
  for (let i = 0; i < 3; i++) moss(ctx, r, r() * size, r() < 0.5 ? size - r() * 20 : r() * 20, 26, 0.6);
  return toTexture(c);
}

function makeEarthBed() {
  const size = 256;
  const r = rng(57);
  const { c, ctx } = canvas(size);
  ctx.fillStyle = "#4a3a24";
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, r, size, 30, ["#5f4a2c", "#3a2c18", "#4e6a24"], 0.4, 10, 40);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = ["#5c7d28", "#466620", "#78963a", "#6b5332"][Math.floor(r() * 4)];
    ctx.globalAlpha = 0.8;
    ctx.fillRect(r() * size, r() * size, 1.5, 3 + r() * 4);
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

/** Flagstone paving for the dais, with grass growing in the joints. */
function makeFlagstones() {
  const size = 1024;
  const r = rng(404);
  const { c, ctx } = canvas(size);
  ctx.fillStyle = "#3f5422";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = ["#58772b", "#476523", "#6e8f36", "#33481a"][Math.floor(r() * 4)];
    ctx.fillRect(r() * size, r() * size, 2, 4);
  }
  const rows = 14;
  const rowH = size / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 60;
    while (x < size) {
      const w = rowH * (0.9 + r() * 1.3);
      const gap = 4 + r() * 3;
      const tone = 120 + Math.floor(r() * 40);
      const warm = Math.floor(r() * 14);
      ctx.fillStyle = `rgb(${tone + warm},${tone + warm * 0.6},${tone - 8})`;
      const x0 = x + gap / 2;
      const y0 = row * rowH + gap / 2;
      const w0 = w - gap;
      const h0 = rowH - gap;
      ctx.beginPath();
      const j = () => (r() - 0.5) * 5;
      ctx.moveTo(x0 + j(), y0 + j());
      ctx.lineTo(x0 + w0 + j(), y0 + j());
      ctx.lineTo(x0 + w0 + j(), y0 + h0 + j());
      ctx.lineTo(x0 + j(), y0 + h0 + j());
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      blotches(ctx, r, size, 2, ["rgba(255,250,235,0.6)", "rgba(40,36,30,0.6)"], 0.12, 10, 40);
      ctx.restore();
      if (r() < 0.3) moss(ctx, r, x0 + (r() < 0.5 ? 0 : w0), y0 + r() * h0, 16 + r() * 18, 0.7);
      x += w;
    }
  }
  grain(ctx, r, size, 9000, 0.06);
  return toTexture(c, false);
}

function makeMeadowDetail() {
  const size = 256;
  const r = rng(11);
  const { c, ctx } = canvas(size);
  ctx.fillStyle = "#d8e0c8";
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, r, size, 40, ["#f2f5e6", "#b9c4a2", "#e4ead2"], 0.35, 10, 45);
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.floor(r() * 105);
    ctx.fillStyle = `rgb(${v - 20},${v},${v - 40})`;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(r() * size, r() * size, 1.2, 3 + r() * 4);
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

export function makeBanner(color: "w" | "b") {
  const w = 128;
  const h = 256;
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = color === "w" ? "#2f5fc4" : "#b3202f";
  ctx.fillRect(0, 0, w, h);
  const gold = color === "w" ? "#e9c35a" : "#d8dde6";
  ctx.strokeStyle = gold;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 40);
  ctx.fillStyle = gold;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, h - 32);
    ctx.lineTo(i * 32 + 16, h);
    ctx.lineTo(i * 32 + 32, h - 32);
    ctx.fill();
  }
  ctx.font = "700 86px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(color === "w" ? "♔" : "♚", w / 2, h / 2 - 14);
  const tex = toTexture(c, false);
  return tex;
}

export function makeCloud(seed: number) {
  const size = 256;
  const r = rng(seed);
  const { c, ctx } = canvas(size, size / 2);
  for (let i = 0; i < 26; i++) {
    const x = size * (0.18 + r() * 0.64);
    const y = size * 0.5 * (0.45 + r() * 0.3);
    const rad = 18 + r() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return toTexture(c, false);
}

export function makeBlob() {
  const { c, ctx } = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,0.6)");
  g.addColorStop(0.6, "rgba(0,0,0,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c, false);
}

export function makeLabel(ch: string) {
  const { c, ctx } = canvas(128);
  ctx.fillStyle = "#f3d27a";
  ctx.font = "700 84px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 6;
  ctx.fillText(ch, 64, 70);
  return toTexture(c, false);
}

export interface BoardTextures {
  light: THREE.MeshStandardMaterial[];
  dark: THREE.MeshStandardMaterial[];
  /** special tiles for d4, e4, d5, e5 carrying the carved centre emblem */
  center: Record<string, THREE.MeshStandardMaterial>;
  bed: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  body: THREE.MeshStandardMaterial;
  flagstones: THREE.Texture;
  stone: THREE.Texture;
  meadow: THREE.Texture;
  labels: Record<string, THREE.MeshBasicMaterial>;
}

function tileMaterial(map: THREE.Texture, dark: boolean) {
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: map,
    bumpScale: 1.6,
    roughness: dark ? 0.72 : 0.8,
    metalness: 0.02,
  });
}

export function makeBoardTextures(): BoardTextures {
  const light = [1, 2, 3, 4, 5].map((s) => tileMaterial(makeStoneTile(false, s), false));
  const dark = [1, 2, 3, 4, 5].map((s) => tileMaterial(makeStoneTile(true, s), true));
  // canvas corner touching the board centre for each central square (canvas top = rank 8 side)
  const center: Record<string, THREE.MeshStandardMaterial> = {
    d4: tileMaterial(makeStoneTile(true, 40, [256, 0]), true),
    e4: tileMaterial(makeStoneTile(false, 41, [0, 0]), false),
    d5: tileMaterial(makeStoneTile(false, 42, [256, 256]), false),
    e5: tileMaterial(makeStoneTile(true, 43, [0, 256]), true),
  };
  const stone = makeCurbStone();
  const bedTex = makeEarthBed();
  bedTex.repeat.set(4, 4);
  const labels: Record<string, THREE.MeshBasicMaterial> = {};
  for (const ch of "abcdefgh12345678") {
    labels[ch] = new THREE.MeshBasicMaterial({
      map: makeLabel(ch.match(/[a-h]/) ? ch.toUpperCase() : ch),
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
  }
  return {
    light,
    dark,
    center,
    bed: new THREE.MeshStandardMaterial({ map: bedTex, roughness: 1 }),
    curb: new THREE.MeshStandardMaterial({ map: stone, bumpMap: stone, bumpScale: 2, roughness: 0.9 }),
    body: new THREE.MeshStandardMaterial({ color: "#5d594f", map: stone, roughness: 0.95 }),
    flagstones: makeFlagstones(),
    stone,
    meadow: makeMeadowDetail(),
    labels,
  };
}
