
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { addWind } from "./wind";

/** Packed blade data: x, y, z, height, width, yaw, lean, colour index. */
export const BLADE_STRIDE = 8;

let bladeGeo: THREE.BufferGeometry | null = null;

/** A tapered 3-segment blade, 1 unit tall, normals pointing up for soft meadow lighting. */
function getBladeGeometry() {
  if (bladeGeo) return bladeGeo;
  const g = new THREE.BufferGeometry();
  const pos = [-0.5, 0, 0, 0.5, 0, 0, -0.36, 0.42, 0.02, 0.36, 0.42, 0.02, -0.18, 0.76, 0.06, 0.18, 0.76, 0.06, 0, 1, 0.12];
  const shade = [0.35, 0.35, 0.68, 0.68, 0.9, 0.9, 1.15];
  const col: number[] = [];
  const nrm: number[] = [];
  for (const s of shade) {
    col.push(s, s, s);
    nrm.push(0, 1, 0.25);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const front = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
  const back: number[] = [];
  for (let i = 0; i < front.length; i += 3) back.push(front[i], front[i + 2], front[i + 1]);
  g.setIndex([...front, ...back]);
  bladeGeo = g;
  return g;
}

export function GrassBlades({
  data,
  palette,
  amp = 0.32,
}: {
  data: Float32Array;
  palette: string[];
  amp?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.floor(data.length / BLADE_STRIDE);
  const material = useMemo(
    () => addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), "grass", amp, 1),
    [amp],
  );
  const colors = useMemo(() => palette.map((c) => new THREE.Color(c)), [palette]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const k = i * BLADE_STRIDE;
      o.position.set(data[k], data[k + 1], data[k + 2]);
      o.rotation.set(data[k + 6], data[k + 5], 0, "YXZ");
      o.scale.set(data[k + 4], data[k + 3], 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, colors[Math.floor(data[k + 7]) % colors.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [data, count, colors]);

  return (
    <instancedMesh
      ref={ref}
      args={[getBladeGeometry(), material, count]}
      receiveShadow
      raycast={() => null}
    />
  );
}

/** Helper to build blade data incrementally. */
export class BladeBuilder {
  private arr: number[] = [];
  push(x: number, y: number, z: number, h: number, w: number, yaw: number, lean: number, color: number) {
    this.arr.push(x, y, z, h, w, yaw, lean, color);
  }
  /** a small clump of blades around a point */
  tuft(r: () => number, x: number, y: number, z: number, n: number, radius: number, hMin: number, hMax: number, colors: number) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * radius;
      this.push(
        x + Math.cos(a) * d,
        y,
        z + Math.sin(a) * d,
        hMin + r() * (hMax - hMin),
        0.022 + r() * 0.03,
        r() * Math.PI * 2,
        0.1 + r() * 0.45,
        Math.floor(r() * colors),
      );
    }
  }
  build() {
    return new Float32Array(this.arr);
  }
}
