/* eslint-disable react-hooks/immutability -- react-three-fiber useFrame mutates render-scoped scratch objects every frame; imperative animation is the r3f idiom, not a React state bug */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";

export interface FxApi {
  burst(pos: THREE.Vector3, colors: string[], count: number, power: number): void;
  ring(pos: THREE.Vector3, color: string, size: number): void;
  orb(from: THREE.Vector3, to: THREE.Vector3, dur: number, color: string): void;
  shake(amount: number): void;
  flash(pos: THREE.Vector3, color: string, intensity: number): void;
}

const MAX = 240;

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  rot: number;
  spin: number;
}

export function Effects({
  fxRef,
  shakeTarget,
}: {
  fxRef: MutableRefObject<FxApi | null>;
  shakeTarget: RefObject<THREE.Group | null>;
}) {
  const inst = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const ringMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const orbGroup = useRef<THREE.Group>(null);
  const orbCore = useRef<THREE.MeshBasicMaterial>(null);

  const state = useMemo(
    () => ({
      particles: Array.from(
        { length: MAX },
        (): Particle => ({
          alive: false,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          life: 0,
          max: 1,
          size: 0.05,
          rot: 0,
          spin: 0,
        }),
      ),
      next: 0,
      rings: Array.from({ length: 3 }, () => ({ active: false, t: 0, dur: 0.8, size: 1 })),
      ringNext: 0,
      orb: { active: false, t: 0, dur: 0.3, from: new THREE.Vector3(), to: new THREE.Vector3() },
      shake: 0,
      flash: 0,
      dummy: new THREE.Object3D(),
      tmpColor: new THREE.Color(),
    }),
    [],
  );

  useEffect(() => {
    const mesh = inst.current;
    if (mesh) {
      for (let i = 0; i < MAX; i++) mesh.setColorAt(i, state.tmpColor.set("#ffffff"));
    }
  }, [state]);

  useEffect(() => {
    const spawn = (pos: THREE.Vector3, vel: THREE.Vector3, life: number, size: number, color: string) => {
      const p = state.particles[state.next];
      state.next = (state.next + 1) % MAX;
      p.alive = true;
      p.pos.copy(pos);
      p.vel.copy(vel);
      p.life = p.max = life;
      p.size = size;
      p.rot = Math.random() * 6;
      p.spin = (Math.random() - 0.5) * 12;
      inst.current?.setColorAt(state.particles.indexOf(p), state.tmpColor.set(color));
      if (inst.current?.instanceColor) inst.current.instanceColor.needsUpdate = true;
    };

    const api: FxApi = {
      burst(pos, colors, count, power) {
        const v = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const up = 0.4 + Math.random() * 0.9;
          const sp = (0.4 + Math.random()) * power;
          v.set(Math.cos(a) * sp, up * power * 0.9, Math.sin(a) * sp);
          spawn(pos, v, 0.7 + Math.random() * 0.8, 0.035 + Math.random() * 0.05, colors[i % colors.length]);
        }
      },
      ring(pos, color, size) {
        const idx = state.ringNext;
        state.ringNext = (state.ringNext + 1) % state.rings.length;
        const r = state.rings[idx];
        r.active = true;
        r.t = 0;
        r.dur = 0.75;
        r.size = size;
        const m = ringMeshes.current[idx];
        if (m) {
          m.position.set(pos.x, 0.05, pos.z);
          (m.material as THREE.MeshBasicMaterial).color.set(color);
        }
      },
      orb(from, to, dur, color) {
        state.orb.active = true;
        state.orb.t = 0;
        state.orb.dur = dur;
        state.orb.from.copy(from);
        state.orb.to.copy(to);
        orbCore.current?.color.set(color);
        if (light.current) light.current.color.set(color);
      },
      shake(amount) {
        state.shake = Math.max(state.shake, amount);
      },
      flash(pos, color, intensity) {
        if (!light.current) return;
        light.current.position.copy(pos);
        light.current.color.set(color);
        state.flash = intensity;
      },
    };
    fxRef.current = api;
    return () => {
      fxRef.current = null;
    };
  }, [fxRef, state]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const mesh = inst.current;
    if (mesh) {
      const d = state.dummy;
      for (let i = 0; i < MAX; i++) {
        const p = state.particles[i];
        if (p.alive) {
          p.life -= dt;
          if (p.life <= 0) p.alive = false;
          p.vel.y -= 9 * dt;
          p.pos.addScaledVector(p.vel, dt);
          if (p.pos.y < 0.03) {
            p.pos.y = 0.03;
            p.vel.y *= -0.35;
            p.vel.x *= 0.7;
            p.vel.z *= 0.7;
          }
          p.rot += p.spin * dt;
        }
        d.position.copy(p.pos);
        d.rotation.set(p.rot, p.rot * 0.7, 0);
        d.scale.setScalar(p.alive ? p.size * Math.min(1, (p.life / p.max) * 3) : 0);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // shockwave rings
    state.rings.forEach((r, i) => {
      const m = ringMeshes.current[i];
      if (!m) return;
      if (!r.active) {
        m.visible = false;
        return;
      }
      r.t += dt;
      const u = r.t / r.dur;
      if (u >= 1) {
        r.active = false;
        m.visible = false;
        return;
      }
      m.visible = true;
      const e = 1 - Math.pow(1 - u, 3);
      m.scale.setScalar(0.2 + r.size * e);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.7;
    });

    // magic orb
    const o = state.orb;
    const g = orbGroup.current;
    if (g) {
      if (o.active) {
        o.t += dt;
        const u = Math.min(1, o.t / o.dur);
        g.visible = true;
        g.position.lerpVectors(o.from, o.to, u * u * (3 - 2 * u));
        g.position.y += Math.sin(u * Math.PI) * 0.25;
        const pulse = 1 + Math.sin(o.t * 40) * 0.15;
        g.scale.setScalar((0.6 + 0.6 * u) * pulse);
        // glittering trail
        if (Math.random() < 0.9) {
          const v = new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
          const p = state.particles[state.next];
          state.next = (state.next + 1) % MAX;
          p.alive = true;
          p.pos.copy(g.position);
          p.vel.copy(v);
          p.life = p.max = 0.4;
          p.size = 0.04;
          p.rot = 0;
          p.spin = 5;
        }
        if (light.current) {
          light.current.position.copy(g.position);
          light.current.intensity = 5;
        }
        if (u >= 1) {
          o.active = false;
          g.visible = false;
          state.flash = 14;
        }
      } else {
        g.visible = false;
      }
    }

    // flash light
    if (light.current && !o.active) {
      state.flash *= Math.exp(-dt * 9);
      light.current.intensity = state.flash < 0.05 ? 0 : state.flash;
    }

    // screen shake (shakes the whole board group)
    const target = shakeTarget.current;
    if (target) {
      state.shake *= Math.exp(-dt * 7);
      if (state.shake < 0.002) {
        state.shake = 0;
        target.position.set(0, 0, 0);
      } else {
        target.position.set((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake * 0.6, (Math.random() - 0.5) * state.shake);
      }
    }
  });

  return (
    <>
      <instancedMesh ref={inst} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            ringMeshes.current[i] = m;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          raycast={() => null}
        >
          <ringGeometry args={[0.92, 1, 64]} />
          <meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
      <group ref={orbGroup} visible={false}>
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.1, 20, 16]} />
          <meshBasicMaterial ref={orbCore} color="#9fe8ff" toneMapped={false} />
        </mesh>
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.2, 20, 16]} />
          <meshBasicMaterial color="#9fe8ff" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} intensity={0} distance={8} decay={2} />
    </>
  );
}
