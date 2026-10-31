
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";
import type { BoardAction, PieceState } from "../boardModel";
import { buildTimeline, sqToWorld, type Timeline } from "../timeline";
import type { PieceType } from "../types";
import { idleYaw, poseCastleRook, poseMover, poseVictim, resetPose, restParts, type Pose } from "./animations";
import type { FxApi } from "./Effects";
import { createPiece, pieceHitGeometry, TEAM_COLORS } from "./pieceModels";

export interface TimeState {
  key: number;
  t0: number;
  tl: Timeline | null;
  fired: Record<string, boolean>;
}

export function ensureTime(ref: MutableRefObject<TimeState>, action: BoardAction | null, now: number): TimeState | null {
  if (!action) return null;
  if (ref.current.key !== action.key) {
    ref.current = { key: action.key, t0: now, tl: buildTimeline(action), fired: {} };
  }
  return ref.current;
}

const BLOODIED = new THREE.Color("#5a0006");

function hashPhase(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 628) / 100;
}

interface Props {
  piece: PieceState;
  action: BoardAction | null;
  timeRef: MutableRefObject<TimeState>;
  speed: number;
  fx: RefObject<FxApi | null>;
  selected: boolean;
  interactive: boolean;
  onPick: (square: string) => void;
  onHover: (square: string | null) => void;
  blood: boolean;
}

function PieceViewImpl({ piece, action, timeRef, speed, fx, selected, interactive, onPick, onHover, blood }: Props) {
  const rootRef = useRef<THREE.Group>(null);
  const leanRef = useRef<THREE.Group>(null);
  const [shownType, setShownType] = useState<PieceType>(piece.type);
  const inst = useMemo(() => createPiece(shownType, piece.color), [shownType, piece.color]);
  const pose = useMemo<Pose>(() => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, sx: 1, sy: 1, sz: 1, visible: true }), []);
  const phase = useMemo(() => hashPhase(piece.id), [piece.id]);
  const lift = useRef(0);
  const hovered = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);
  const speedRef = useRef(speed);
  const bloodRef = useRef(blood);
  useEffect(() => {
    speedRef.current = speed;
    bloodRef.current = blood;
  }, [speed, blood]);
  // per-victim material copies so the hit flash only affects the wounded figure
  const wound = useRef<{ mats: THREE.MeshStandardMaterial[]; base: THREE.Color[] } | null>(null);
  const hitGeo = useMemo(() => pieceHitGeometry(shownType), [shownType]);

  useFrame((state, dt) => {
    const g = rootRef.current;
    const l = leanRef.current;
    if (!g || !l) return;
    const now = state.clock.elapsedTime;
    const ts = ensureTime(timeRef, action, now);
    const base = sqToWorld(piece.square);
    resetPose(pose, base.x, base.z, idleYaw(piece.color));
    restParts(shownType, inst.parts, now, phase);

    let wantType: PieceType = piece.type;
    if (ts?.tl && action) {
      const tl = ts.tl;
      const t = (now - ts.t0) * speedRef.current;
      const cols = TEAM_COLORS[piece.color];

      if (piece.id === action.moverId) {
        if (action.promotion && t < tl.landAt) wantType = action.moverType;
        poseMover(pose, inst.parts, action, tl, t, action.moverType, piece.color);

        if (action.moverType === "b" && tl.capture && !ts.fired.orb && t >= tl.attackStart + 0.6) {
          ts.fired.orb = true;
          if (inst.parts.tip) inst.parts.tip.getWorldPosition(tmp);
          else tmp.set(pose.x, 1.4, pose.z);
          tmp2.set(tl.target.x, 0.8, tl.target.z);
          fx.current?.orb(tmp, tmp2, 0.32 / speedRef.current, "#8fe6ff");
        }
        if (action.promotion && t >= tl.landAt && !ts.fired.promo) {
          ts.fired.promo = true;
          tmp.set(tl.to.x, 0.9, tl.to.z);
          fx.current?.burst(tmp, [cols.spark, cols.accent, "#ffffff"], 40, 3.4);
          fx.current?.ring(tmp, cols.spark, 2.2);
          fx.current?.flash(tmp, cols.spark, 10);
        }
      } else if (piece.id === action.victimId) {
        poseVictim(pose, action, tl, t, piece.color);
        const since = t - tl.impact;
        if (since >= 0) {
          if (!wound.current) {
            const mats: THREE.MeshStandardMaterial[] = [];
            inst.root.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh && (m.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const copy = (m.material as THREE.MeshStandardMaterial).clone();
                m.material = copy;
                mats.push(copy);
              }
            });
            wound.current = { mats, base: mats.map((m) => m.color.clone()) };
          }
          const flash = Math.max(0, 1 - since / 0.45);
          const red = bloodRef.current;
          wound.current.mats.forEach((m, i) => {
            m.emissive.set(red ? "#ff1a10" : "#ffffff");
            m.emissiveIntensity = flash * (red ? 2.2 : 1.4);
            if (red) m.color.copy(wound.current!.base[i]).lerp(BLOODIED, Math.min(0.55, since * 1.1));
          });
        }
        if (t - tl.impact >= 0.6 && !ts.fired.dissolve) {
          ts.fired.dissolve = true;
          tmp.set(tl.target.x, 0.5, tl.target.z);
          fx.current?.burst(tmp, bloodRef.current ? ["#7a0309", "#4a0105", cols.main] : [cols.spark, cols.accent, cols.main, cols.cloth], 22, 2.6);
        }
      } else if (action.rook && piece.id === action.rook.id) {
        poseCastleRook(pose, tl, t, action, piece.color);
      }
    }
    if (wantType !== shownType) setShownType(wantType);

    const target = selected ? 0.2 + Math.sin(now * 4) * 0.03 : hovered.current && interactive ? 0.07 : 0;
    lift.current += (target - lift.current) * Math.min(1, dt * 10);

    g.position.set(pose.x, pose.y + lift.current, pose.z);
    g.rotation.y = pose.yaw;
    g.scale.set(pose.sx, pose.sy * (1 + Math.sin(now * 1.7 + phase) * 0.006), pose.sz);
    g.visible = pose.visible;
    l.rotation.x = pose.pitch;
  });

  return (
    <group ref={rootRef}>
      <group ref={leanRef}>
        <primitive object={inst.root} />
      </group>
      {!piece.dead && (
        <mesh
          visible={false}
          geometry={hitGeo}
          onClick={(e) => {
            e.stopPropagation();
            onPick(piece.square);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            hovered.current = true;
            onHover(piece.square);
          }}
          onPointerOut={() => {
            hovered.current = false;
            onHover(null);
          }}
        >
          <meshBasicMaterial side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export const PieceView = memo(PieceViewImpl);
