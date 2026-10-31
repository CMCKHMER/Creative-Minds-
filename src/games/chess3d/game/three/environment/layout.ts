import { fbm, noise2, smoothstep } from "./noise";

/** Shared dimensions of the arena (world units; one square = 1). */
export const CURB_IN = 4.06;
export const CURB_OUT = 4.9;
export const CURB_TOP = 0.1;

/** Octagonal dais that the board rests on (flat sides face the four axes). */
export const DAIS_R = 9.6;
export const DAIS_APOTHEM = DAIS_R * Math.cos(Math.PI / 8);
export const DAIS_TOP = -0.42;
export const GROUND_Y = -1.3;

/** Army camps behind each side of the board. */
export const CAMPS = [
  { z: 25, color: "w" as const },
  { z: -25, color: "b" as const },
];

/** 1 on the dirt road that leads from each staircase to its camp, 0 elsewhere. */
export function onPath(x: number, z: number) {
  const az = Math.abs(z);
  if (az < DAIS_APOTHEM + 0.6) return 0;
  const wobble = (Math.sin(z * 0.13) * 1.4 + (fbm(z * 0.05, 3.1) - 0.5) * 2.4) * smoothstep(10, 16, az);
  const width = 1.25 + az * 0.012;
  const d = Math.abs(x - wobble);
  const fadeOut = 1 - smoothstep(34, 40, az);
  return (1 - smoothstep(width * 0.55, width, d)) * fadeOut;
}

/** Height of the meadow around the arena. */
export function terrainHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const near = smoothstep(10, 18, r);
  const hills = (fbm(x * 0.024 + 10, z * 0.024 - 4) - 0.38) * 10 * smoothstep(18, 48, r);
  const far = smoothstep(60, 130, r) * 12;
  const bumps = (noise2(x * 0.35, z * 0.35) - 0.5) * 0.2 * (0.35 + near);
  const path = onPath(x, z);
  return GROUND_Y + Math.max(hills, -0.6) * (1 - path * 0.75) + far + bumps * (1 - path * 0.8);
}

/** Top surface at (x, z): board, stone curb, dais or meadow (used to land blood drops). */
export function surfaceY(x: number, z: number) {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax < CURB_IN && az < CURB_IN) return 0;
  if (ax < CURB_OUT && az < CURB_OUT) return CURB_TOP;
  if (Math.max(ax, az, (ax + az) * Math.SQRT1_2) < DAIS_APOTHEM) return DAIS_TOP;
  return terrainHeight(x, z);
}
