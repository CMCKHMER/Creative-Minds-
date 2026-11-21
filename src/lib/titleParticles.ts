// A heading as particles — the three.js painter. Used by the hero title and
// by the TOEFL ITP Bi-Weekly Planner heading on the home page (see
// hooks/useTitleParticles.ts).
//
// Loaded with a dynamic import so three.js stays out of the first download
// (see manualChunks in vite.config.ts). The engine — letter sampling, motion,
// when to draw — is titleParticlesCore.ts; this file only draws its dots.

import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  NormalBlending,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';
import { mountDots, type DotPainter, type TitleParticlesOptions } from './titleParticlesCore';

export type { TitleParticlesOptions } from './titleParticlesCore';

const VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vPointSize;
  void main() {
    vColor = color;
    gl_PointSize = size * uPixelRatio;
    vPointSize = gl_PointSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vPointSize;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    // Crisp ~1 device-pixel anti-aliased edge instead of a wide soft halo,
    // so dispersing dots stay distinct pinpoints instead of muddying into blotches.
    float aa = clamp(1.1 / max(vPointSize, 1.0), 0.05, 0.22);
    float a = smoothstep(0.5, 0.5 - aa, d) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/** Draws the dots as WebGL points. Throws when the browser gives no WebGL context. */
function webglPainter(canvas: HTMLCanvasElement): DotPainter {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.sortObjects = false; // one object; sorting would measure a 2-D position buffer as 3-D

  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, 1, -1, 1);
  const makeMaterial = () => new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending,
  });
  let material = makeMaterial();
  let geometry = new BufferGeometry();
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let ratio = 1;
  let onLost: ((e: Event) => void) | undefined;
  let onRestored: (() => void) | undefined;

  return {
    resize(width, height, pixelRatio) {
      ratio = pixelRatio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      material.uniforms.uPixelRatio.value = ratio;
      camera.right = width;
      camera.bottom = height;
      camera.updateProjectionMatrix();
    },
    setDots(pos, colors, sizes) {
      geometry.dispose();
      geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(pos, 2).setUsage(DynamicDrawUsage));
      geometry.setAttribute('color', new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage));
      geometry.setAttribute('size', new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage));
      points.geometry = geometry;
    },
    draw(opacity) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;
      material.uniforms.uOpacity.value = opacity;
      renderer.render(scene, camera);
    },
    clear() {
      renderer.clear();
    },
    watch(lost, restored) {
      onLost = (e) => {
        e.preventDefault();
        material.uniforms.uOpacity.value = 0;
        lost();
      };
      onRestored = () => {
        // The old buffers and shader died with the old context. Start with
        // fresh objects instead of disposing the old ones: three.js would try
        // to delete them in the new context, which the browser reports as an
        // error. The engine hands the dots over again through setDots().
        geometry = new BufferGeometry();
        material = makeMaterial();
        material.uniforms.uPixelRatio.value = ratio;
        points.geometry = geometry;
        points.material = material;
        restored();
      };
      canvas.addEventListener('webglcontextlost', onLost);
      canvas.addEventListener('webglcontextrestored', onRestored);
    },
    dispose() {
      if (onLost) canvas.removeEventListener('webglcontextlost', onLost);
      if (onRestored) canvas.removeEventListener('webglcontextrestored', onRestored);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

/** Starts the effect. Returns the function that removes it again. */
export function mountTitleParticles(options: TitleParticlesOptions): () => void {
  let painter: DotPainter;
  try {
    painter = webglPainter(options.canvas);
  } catch {
    options.onActive(false);
    return () => {};
  }
  return mountDots(options, painter);
}
