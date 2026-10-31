import type { BoardAction } from "../boardModel";
import { ATTACKS, type Timeline } from "../timeline";
import type { PieceType } from "../types";
import { REST, type Parts } from "./pieceModels";

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  sx: number;
  sy: number;
  sz: number;
  visible: boolean;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const easeInOut = (t: number) => {
  const c = clamp01(t);
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
};
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Keyframe interpolation with smoothstep easing between frames. */
export function kf(t: number, frames: [number, number][]): number {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    const [t0, v0] = frames[i - 1];
    if (t <= t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return frames[frames.length - 1][1];
}

export function idleYaw(color: "w" | "b") {
  // white faces -z (towards black), black faces +z
  return color === "w" ? Math.PI : 0;
}

export function resetPose(p: Pose, x: number, z: number, yaw: number) {
  p.x = x;
  p.y = 0;
  p.z = z;
  p.yaw = yaw;
  p.pitch = 0;
  p.sx = p.sy = p.sz = 1;
  p.visible = true;
}

/** Put the animatable parts back into their idle rotation. */
export function restParts(type: PieceType, parts: Parts, now: number, phase: number) {
  if (parts.armR && parts.weapon && (type === "p" || type === "b" || type === "q" || type === "k")) {
    const r = REST[type];
    parts.armR.rotation.set(r.armX + Math.sin(now * 1.4 + phase) * 0.015, 0, r.armZ);
    parts.weapon.rotation.set(r.wX, 0, r.wZ);
    if (parts.slide) parts.slide.position.y = 0;
  }
  if (parts.flag) parts.flag.rotation.y = Math.sin(now * 3 + phase) * 0.45;
  if (parts.cape) parts.cape.rotation.x = 0.03 + Math.sin(now * 1.3 + phase) * 0.035;
}

const BOB: Record<PieceType, number> = { p: 0.05, r: 0.028, n: 0, b: 0.022, q: 0.03, k: 0.035 };

function travel(
  pose: Pose,
  type: PieceType,
  from: { x: number; z: number },
  to: { x: number; z: number },
  u: number,
  hop: number,
) {
  const e = easeInOut(u);
  pose.x = lerp(from.x, to.x, e);
  pose.z = lerp(from.z, to.z, e);
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  if (dist < 0.05) return;
  if (hop > 0) {
    pose.y += 4 * u * (1 - u) * hop;
    pose.pitch += -0.32 * (1 - 2 * u) * (type === "n" ? 1 : 0.3);
    const crouch = Math.max(smooth(1 - u / 0.14) * 0.1, smooth((u - 0.88) / 0.12) * 0.07);
    pose.sy *= 1 - crouch;
  } else {
    const steps = Math.max(2, Math.round(dist * 1.5 + 1));
    pose.y += Math.abs(Math.sin(u * Math.PI * steps)) * BOB[type];
    pose.pitch += 0.07 * Math.sin(u * Math.PI);
  }
}

interface AttackOut {
  lunge: number;
  y: number;
  pitch: number;
  yaw: number;
  sy: number;
}

/** Pose the attacker `s` seconds into its attack animation. */
function attack(type: PieceType, s: number, out: AttackOut, parts: Parts) {
  switch (type) {
    case "p": {
      if (parts.armR) parts.armR.rotation.x = kf(s, [[0, -0.35], [0.22, -0.95], [0.4, -0.85], [0.52, -1.0], [0.64, -1.0], [1.0, -0.35]]);
      if (parts.weapon) parts.weapon.rotation.x = kf(s, [[0, 0.45], [0.22, 2.3], [0.64, 2.3], [1.0, 0.45]]);
      if (parts.slide) parts.slide.position.y = kf(s, [[0, 0], [0.22, 0], [0.4, -0.14], [0.52, 0.3], [0.64, 0.3], [0.8, 0], [1, 0]]);
      out.lunge = kf(s, [[0, 0], [0.4, -0.05], [0.52, 0.2], [0.7, 0.2], [1, 0]]);
      out.pitch = kf(s, [[0, 0], [0.4, -0.08], [0.52, 0.2], [0.7, 0.15], [1, 0]]);
      break;
    }
    case "r": {
      out.pitch = kf(s, [[0, 0], [0.3, -0.14], [0.45, -0.16], [0.58, 0.42], [0.72, 0.3], [1, 0]]);
      out.lunge = kf(s, [[0, 0], [0.3, -0.12], [0.45, -0.14], [0.58, 0.3], [0.75, 0.22], [1, 0]]);
      out.y = kf(s, [[0, 0], [0.3, 0.04], [0.5, 0.1], [0.58, 0], [1, 0]]);
      out.sy = kf(s, [[0, 1], [0.57, 1], [0.64, 0.93], [0.82, 1]]);
      if (parts.flag) parts.flag.rotation.y = Math.sin(s * 22) * 0.9;
      break;
    }
    case "n": {
      out.pitch = kf(s, [[0, 0], [0.4, -0.6], [0.55, -0.65], [0.62, -0.55], [0.72, 0.55], [0.9, 0.3], [1.15, 0]]);
      out.y = kf(s, [[0, 0], [0.4, 0.18], [0.62, 0.2], [0.72, 0], [1.15, 0]]);
      out.lunge = kf(s, [[0, 0], [0.4, -0.1], [0.62, -0.12], [0.72, 0.3], [0.95, 0.22], [1.15, 0]]);
      break;
    }
    case "b": {
      if (parts.armR) parts.armR.rotation.x = kf(s, [[0, -0.3], [0.35, -2.9], [0.5, -2.9], [0.62, -1.7], [0.9, -1.7], [1.35, -0.3]]);
      if (parts.weapon) parts.weapon.rotation.x = kf(s, [[0, 0.3], [0.35, 2.9], [0.5, 2.9], [0.62, 3.0], [0.9, 3.0], [1.35, 0.3]]);
      out.pitch = kf(s, [[0, 0], [0.35, -0.12], [0.55, -0.14], [0.65, 0.12], [1.35, 0]]);
      out.y = kf(s, [[0, 0], [0.35, 0.12], [0.9, 0.1], [1.35, 0]]);
      break;
    }
    case "q": {
      if (parts.armR) {
        parts.armR.rotation.x = kf(s, [[0, -0.25], [0.15, 0], [0.7, 0], [1.05, -0.25]]);
        parts.armR.rotation.z = kf(s, [[0, 0.18], [0.15, 1.4], [0.7, 1.4], [1.05, 0.18]]);
      }
      if (parts.weapon) {
        parts.weapon.rotation.x = kf(s, [[0, 0.35], [0.15, 0], [0.7, 0], [1.05, 0.35]]);
        parts.weapon.rotation.z = kf(s, [[0, -0.18], [0.15, -2.97], [0.7, -2.97], [1.05, -0.18]]);
      }
      out.yaw = kf(s, [[0, 0], [0.12, 0.6], [0.45, -Math.PI * 2], [0.7, -Math.PI * 2], [1.05, -Math.PI * 2]]);
      out.lunge = kf(s, [[0, 0], [0.12, -0.05], [0.4, 0.25], [0.7, 0.15], [1.05, 0]]);
      out.y = kf(s, [[0, 0], [0.3, 0.05], [0.5, 0.0], [1.05, 0]]);
      break;
    }
    case "k": {
      if (parts.armR) parts.armR.rotation.x = kf(s, [[0, -0.3], [0.5, -2.7], [0.65, -2.75], [0.85, -1.1], [1.1, -1.0], [1.35, -0.3]]);
      if (parts.weapon) parts.weapon.rotation.x = kf(s, [[0, 0.3], [0.5, 2.3], [0.65, 2.3], [0.85, 2.8], [1.1, 2.8], [1.35, 0.3]]);
      out.pitch = kf(s, [[0, 0], [0.5, -0.2], [0.65, -0.22], [0.85, 0.32], [1.1, 0.25], [1.35, 0]]);
      out.lunge = kf(s, [[0, 0], [0.65, -0.08], [0.85, 0.28], [1.1, 0.2], [1.35, 0]]);
      out.y = kf(s, [[0, 0], [0.6, 0.06], [0.85, 0], [1.35, 0]]);
      break;
    }
  }
}

/** Looping showcase pose (used by the lobby display). */
export function showcaseAttack(type: PieceType, s: number, parts: Parts, pose: Pose) {
  const out: AttackOut = { lunge: 0, y: 0, pitch: 0, yaw: 0, sy: 1 };
  attack(type, s, out, parts);
  pose.z += out.lunge;
  pose.y += out.y;
  pose.pitch += out.pitch;
  pose.yaw += out.yaw;
  pose.sy *= out.sy;
}

function faceBlend(t: number, tEnd: number, idle: number, face: number) {
  const inn = smooth(t / 0.2);
  const out = smooth((t - (tEnd - 0.28)) / 0.28);
  return lerpAngle(idle, face, inn * (1 - out));
}

/** Pose for the piece that is moving (and possibly attacking). */
export function poseMover(pose: Pose, parts: Parts, _a: BoardAction, tl: Timeline, t: number, type: PieceType, color: "w" | "b") {
  const idle = idleYaw(color);
  const hop = type === "n" ? 1.3 : 0;
  const stepEnd = tl.capture ? tl.stepEnd : tl.travel;

  if (t >= stepEnd) {
    resetPose(pose, tl.to.x, tl.to.z, idle);
    return;
  }
  pose.yaw = faceBlend(t, stepEnd, idle, tl.moveYaw);

  if (!tl.capture) {
    travel(pose, type, tl.from, tl.to, t / tl.travel, hop);
    return;
  }

  if (t < tl.travel) {
    travel(pose, type, tl.from, tl.stand, t / tl.travel, hop);
    return;
  }
  if (t < tl.stepStart) {
    pose.x = tl.stand.x;
    pose.z = tl.stand.z;
    const s = t - tl.attackStart;
    if (s <= ATTACKS[type].dur) {
      const out: AttackOut = { lunge: 0, y: 0, pitch: 0, yaw: 0, sy: 1 };
      attack(type, s, out, parts);
      pose.x += tl.dir.x * out.lunge;
      pose.z += tl.dir.z * out.lunge;
      pose.y += out.y;
      pose.pitch += out.pitch;
      pose.yaw += out.yaw;
      pose.sy *= out.sy;
    }
    return;
  }
  travel(pose, type, tl.stand, tl.to, (t - tl.stepStart) / (tl.stepEnd - tl.stepStart), hop * 0.5);
}

/** Pose of the rook during castling: it leaps over the king. */
export function poseCastleRook(pose: Pose, tl: Timeline, t: number, a: BoardAction, color: "w" | "b") {
  const idle = idleYaw(color);
  const from = tl.from; // placeholder, replaced below by rook squares
  void from;
  const r = a.rook!;
  const rf = { x: r.from.charCodeAt(0) - 97 - 3.5, z: 4.5 - Number(r.from[1]) };
  const rt = { x: r.to.charCodeAt(0) - 97 - 3.5, z: 4.5 - Number(r.to[1]) };
  const u = (t - tl.rookStart) / tl.rookDur;
  if (u <= 0) {
    resetPose(pose, rf.x, rf.z, idle);
    return;
  }
  if (u >= 1) {
    resetPose(pose, rt.x, rt.z, idle);
    return;
  }
  resetPose(pose, rf.x, rf.z, idle);
  travel(pose, "r", rf, rt, u, 2.1);
  pose.pitch += 0.4 * Math.sin(u * Math.PI * 2) * 0.3;
}

const REACT: Record<PieceType, { knock: number; lift: number; fall: number; spin: number; squash: number; shake: number }> = {
  p: { knock: 0.35, lift: 0.0, fall: 1.45, spin: 0, squash: 0, shake: 0.03 },
  r: { knock: 0.9, lift: 0.25, fall: 1.5, spin: 0.8, squash: 0, shake: 0.14 },
  n: { knock: 0.7, lift: 0.35, fall: 1.4, spin: 1.8, squash: 0, shake: 0.08 },
  b: { knock: 0.6, lift: 0.9, fall: 1.2, spin: 7, squash: 0, shake: 0.06 },
  q: { knock: 0.8, lift: 0.3, fall: 1.5, spin: 4.5, squash: 0, shake: 0.08 },
  k: { knock: 0.2, lift: 0, fall: 0.35, spin: 0, squash: 0.6, shake: 0.12 },
};
export const reactionShake = (type: PieceType) => REACT[type].shake;
/** how far the victim is knocked back by an attacker of this type */
export const victimKnock = (type: PieceType) => REACT[type].knock;

/** Pose for the captured piece: turns to face the attacker, is struck, falls and dissolves. */
export function poseVictim(pose: Pose, a: BoardAction, tl: Timeline, t: number, color: "w" | "b") {
  const idle = idleYaw(color);
  const react = REACT[a.moverType];
  const vp = tl.target;
  resetPose(pose, vp.x, vp.z, idle);
  const faceAttacker = Math.atan2(-tl.dir.x, -tl.dir.z);
  pose.yaw = lerpAngle(idle, faceAttacker, smooth(t / Math.max(0.3, tl.travel * 0.9)));

  const s = t - tl.impact;
  if (s < 0) return;

  const k = clamp01(s / 0.6);
  pose.x += tl.dir.x * react.knock * easeOut(k);
  pose.z += tl.dir.z * react.knock * easeOut(k);
  const fall = react.fall * k * k;
  pose.pitch = -fall;
  pose.y = Math.sin(Math.min(Math.abs(fall), Math.PI / 2)) * 0.3 + react.lift * 4 * k * (1 - k);
  pose.yaw += react.spin * (1 - Math.pow(1 - k, 2)) * 1.4;

  if (react.squash > 0) {
    const q = smooth(s / 0.15);
    pose.sy = 1 - react.squash * q;
    pose.sx = pose.sz = 1 + 0.35 * react.squash * q;
    pose.pitch = 0;
    pose.y = 0;
  }

  if (s > 0.6) {
    const d = smooth((s - 0.6) / 0.4);
    const sc = 1 - d;
    pose.sx *= sc;
    pose.sy *= sc;
    pose.sz *= sc;
    pose.y += d * 0.1;
    if (s >= 1.0) pose.visible = false;
  }
}
