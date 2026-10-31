
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BoardAction, PieceState } from "../boardModel";
import type { SfxKind } from "../sound";
import { ATTACKS } from "../timeline";
import type { Color } from "../types";
import { reactionShake, victimKnock } from "./animations";
import { Blood, type BloodApi } from "./Blood";
import { BattleBoard } from "./environment/BattleBoard";
import { Battlefield, FOG_COLOR } from "./environment/Battlefield";
import { Effects, type FxApi } from "./Effects";
import { makeBoardTextures } from "./boardTextures";
import { PieceView, ensureTime, type TimeState } from "./PieceView";
import { TEAM_COLORS } from "./pieceModels";
import { SceneLights } from "./SceneLights";

export interface ChessSceneProps {
  pieces: PieceState[];
  action: BoardAction | null;
  speed: number;
  selectedSquare: string | null;
  targets: { square: string; capture: boolean }[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  interactive: boolean;
  side: Color;
  flipSignal: number;
  canClick: (square: string) => boolean;
  onSquare: (square: string) => void;
  onSfx: (kind: SfxKind) => void;
  /** show blood when units are wounded */
  blood: boolean;
}

const sqPos = (sq: string): [number, number] => [sq.charCodeAt(0) - 97 - 3.5, 4.5 - Number(sq[1])];

/* ------------------------------------------------------------------ */
/* Highlights                                                           */
/* ------------------------------------------------------------------ */

function CheckGlow({ square }: { square: string }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const [x, z] = sqPos(square);
  useFrame((s) => {
    if (mat.current) mat.current.opacity = 0.45 + Math.sin(s.clock.elapsedTime * 5) * 0.2;
  });
  return (
    <mesh position={[x, 0.016, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={2}>
      <circleGeometry args={[0.62, 40]} />
      <meshBasicMaterial ref={mat} color="#ff2a3a" transparent opacity={0.5} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

const Highlights = memo(function Highlights({
  selectedSquare,
  targets,
  lastMove,
  checkSquare,
  hover,
  hoverActive,
}: {
  selectedSquare: string | null;
  targets: { square: string; capture: boolean }[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  hover: string | null;
  hoverActive: boolean;
}) {
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const dot = useMemo(() => new THREE.CircleGeometry(0.15, 28), []);
  const ring = useMemo(() => new THREE.RingGeometry(0.36, 0.47, 40), []);
  const mats = useMemo(() => {
    const base = { transparent: true, depthWrite: false, toneMapped: false } as const;
    return {
      last: new THREE.MeshBasicMaterial({ ...base, color: "#f3c34a", opacity: 0.32 }),
      sel: new THREE.MeshBasicMaterial({ ...base, color: "#5cf0a6", opacity: 0.5 }),
      dot: new THREE.MeshBasicMaterial({ ...base, color: "#5cf0a6", opacity: 0.85 }),
      cap: new THREE.MeshBasicMaterial({ ...base, color: "#ff5a5a", opacity: 0.9 }),
      hover: new THREE.MeshBasicMaterial({ ...base, color: "#ffffff", opacity: 0.18 }),
    };
  }, []);
  const flat = [-Math.PI / 2, 0, 0] as const;

  return (
    <group>
      {lastMove &&
        [lastMove.from, lastMove.to].map((sq) => {
          const [x, z] = sqPos(sq);
          return <mesh key={`l${sq}`} geometry={plane} material={mats.last} position={[x, 0.012, z]} rotation={flat} raycast={() => null} renderOrder={1} />;
        })}
      {selectedSquare &&
        (() => {
          const [x, z] = sqPos(selectedSquare);
          return <mesh geometry={plane} material={mats.sel} position={[x, 0.014, z]} rotation={flat} raycast={() => null} renderOrder={1} />;
        })()}
      {hover && hoverActive &&
        (() => {
          const [x, z] = sqPos(hover);
          return <mesh geometry={plane} material={mats.hover} position={[x, 0.013, z]} rotation={flat} raycast={() => null} renderOrder={1} />;
        })()}
      {targets.map((t) => {
        const [x, z] = sqPos(t.square);
        return t.capture ? (
          <mesh key={`t${t.square}`} geometry={ring} material={mats.cap} position={[x, 0.02, z]} rotation={flat} raycast={() => null} renderOrder={2} />
        ) : (
          <mesh key={`t${t.square}`} geometry={dot} material={mats.dot} position={[x, 0.02, z]} rotation={flat} raycast={() => null} renderOrder={2} />
        );
      })}
      {checkSquare && <CheckGlow square={checkSquare} />}
    </group>
  );
});

/* ------------------------------------------------------------------ */
/* Camera                                                               */
/* ------------------------------------------------------------------ */

function CameraRig({ side, flipSignal }: { side: Color; flipSignal: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const anim = useRef<{ t: number } | null>(null);
  const lastFlip = useRef(flipSignal);

  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    const dist = Math.min(30, 14.2 * Math.max(1, 1.5 / aspect));
    const sign = side === "w" ? 1 : -1;
    camera.position.set(0, dist * 0.8, sign * dist * 0.6);
    camera.lookAt(0, 0.3, 0);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  useEffect(() => {
    if (flipSignal !== lastFlip.current) {
      lastFlip.current = flipSignal;
      anim.current = { t: 0 };
    }
  }, [flipSignal]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a) return;
    const ease = (u: number) => u * u * (3 - 2 * u);
    const dur = 1.2;
    const prev = ease(Math.min(1, a.t / dur));
    a.t += dt;
    const next = ease(Math.min(1, a.t / dur));
    camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), (next - prev) * Math.PI);
    controls.current?.update();
    if (a.t >= dur) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={7}
      maxDistance={30}
      minPolarAngle={0.2}
      maxPolarAngle={1.42}
      target={[0, 0.3, 0]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Action director – fires effects and sounds at the right moments      */
/* ------------------------------------------------------------------ */

function Director({
  action,
  timeRef,
  speed,
  fx,
  onSfx,
  blood,
  bloodApi,
}: {
  action: BoardAction | null;
  timeRef: React.MutableRefObject<TimeState>;
  speed: number;
  fx: React.RefObject<FxApi | null>;
  onSfx: (k: SfxKind) => void;
  blood: boolean;
  bloodApi: React.RefObject<BloodApi | null>;
}) {
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const ts = ensureTime(timeRef, action, now);
    if (!ts?.tl || !action) return;
    const tl = ts.tl;
    const t = (now - ts.t0) * speed;
    const f = ts.fired;
    const api = fx.current;

    if (tl.capture) {
      const atk = ATTACKS[action.moverType];
      if (!f.swing && t >= tl.attackStart + atk.hit - 0.32) {
        f.swing = true;
        onSfx("swing");
      }
      if (!f.impact && t >= tl.impact) {
        f.impact = true;
        onSfx("capture");
        if (api) {
          const v = action.victimColor ? TEAM_COLORS[action.victimColor] : TEAM_COLORS.w;
          const pos = new THREE.Vector3(tl.target.x, 0.55, tl.target.z);
          api.burst(pos, [v.spark, v.accent, v.main], blood ? 12 : 30, 3.4);
          api.flash(pos, blood ? "#ff3020" : v.spark, 9);
          api.shake(reactionShake(action.moverType));
          if (action.moverType === "r" || action.moverType === "q" || action.moverType === "k" || action.moverType === "n") {
            api.ring(pos, action.moverType === "q" ? "#ff9ae0" : "#ffe6a0", action.moverType === "r" ? 2.6 : 1.7);
          }
        }
      }
    }
    // blood: spray at the hit, follow-up spurts while the unit falls, then a pool where it lies
    const bl = bloodApi.current;
    if (tl.capture && blood && bl) {
      const heavy = action.moverType === "r" || action.moverType === "k" || action.moverType === "n";
      if (!f.bImpact && t >= tl.impact) {
        f.bImpact = true;
        const pos = new THREE.Vector3(tl.target.x, 0.6, tl.target.z);
        bl.spray(pos, tl.dir, heavy ? 70 : 48, heavy ? 3.0 : 2.5);
        bl.splat(tl.target.x + tl.dir.x * 0.35, tl.target.z + tl.dir.z * 0.35, heavy ? 1.15 : 0.9, 2, Math.atan2(-tl.dir.x, -tl.dir.z));
        bl.splat(tl.target.x, tl.target.z, 0.55, 1);
      }
      const knock = victimKnock(action.moverType);
      for (const [key, dt, n] of [["bSpurt1", 0.2, 22], ["bSpurt2", 0.42, 14]] as const) {
        if (!f[key] && t >= tl.impact + dt) {
          f[key] = true;
          const k = Math.min(1, dt / 0.6);
          const pos = new THREE.Vector3(tl.target.x + tl.dir.x * knock * k, 0.45, tl.target.z + tl.dir.z * knock * k);
          bl.spray(pos, tl.dir, n, 1.5);
        }
      }
      if (!f.bPool && t >= tl.impact + 0.5) {
        f.bPool = true;
        bl.splat(tl.target.x + tl.dir.x * knock, tl.target.z + tl.dir.z * knock, 1.25, 3);
      }
    }

    if (!f.land && t >= tl.landAt) {
      f.land = true;
      if (!tl.capture) {
        onSfx(tl.castle ? "castle" : "move");
        if (api && (action.moverType === "r" || action.moverType === "n")) {
          api.burst(new THREE.Vector3(tl.to.x, 0.05, tl.to.z), ["#d8cfbd", "#b9ae98"], 8, 0.9);
        }
      }
    }
    if (!f.after && t >= tl.landAt + (tl.capture ? 0.1 : 0.05)) {
      f.after = true;
      if (action.mate) onSfx("mate");
      else if (action.check) onSfx("check");
      else if (action.promotion) onSfx("promote");
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Scene                                                                */
/* ------------------------------------------------------------------ */

function SceneContents(p: ChessSceneProps) {
  const fx = useRef<FxApi | null>(null);
  const bloodApi = useRef<BloodApi | null>(null);
  const shakeRef = useRef<THREE.Group>(null);
  const timeRef = useRef<TimeState>({ key: -1, t0: 0, tl: null, fired: {} });
  const [hover, setHover] = useState<string | null>(null);
  const tex = useMemo(() => makeBoardTextures(), []);

  const { canClick, onSquare, interactive } = p;
  const handleSquare = useCallback((sq: string) => onSquare(sq), [onSquare]);
  const hoverActive = hover ? canClick(hover) && interactive : false;

  useEffect(() => {
    document.body.style.cursor = hoverActive ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hoverActive]);

  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, 45, 330]} />
      <SceneLights variant="outdoor" />
      <group ref={shakeRef}>
        <Battlefield tex={tex} />
        <BattleBoard tex={tex} onSquare={handleSquare} onHover={setHover} />
        <Highlights
          selectedSquare={p.selectedSquare}
          targets={p.targets}
          lastMove={p.lastMove}
          checkSquare={p.checkSquare}
          hover={hover}
          hoverActive={hoverActive}
        />
        {p.pieces.map((piece) => (
          <PieceView
            key={piece.id}
            piece={piece}
            action={p.action}
            timeRef={timeRef}
            speed={p.speed}
            fx={fx}
            selected={p.selectedSquare === piece.square && !piece.dead}
            interactive={p.interactive}
            onPick={handleSquare}
            onHover={setHover}
            blood={p.blood}
          />
        ))}
        <Blood apiRef={bloodApi} />
      </group>
      <Effects fxRef={fx} shakeTarget={shakeRef} />
      <Director action={p.action} timeRef={timeRef} speed={p.speed} fx={fx} onSfx={p.onSfx} blood={p.blood} bloodApi={bloodApi} />
      <CameraRig side={p.side} flipSignal={p.flipSignal} />
    </>
  );
}

export default function ChessScene(props: ChessSceneProps) {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      camera={{ fov: 38, near: 0.5, far: 900, position: [0, 9, 11] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <SceneContents {...props} />
    </Canvas>
  );
}
