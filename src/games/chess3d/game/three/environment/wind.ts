import * as THREE from "three";

/** Global wind clock shared by every swaying material (updated once per frame). */
export const windUniform = { value: 0 };

type Mode = "grass" | "tree" | "banner";

/**
 * Patches a built-in material so its vertices sway in the wind.
 * - grass/tree: instanced, bends with height in world space (all blades lean the same way)
 * - banner: cloth hanging from its top edge, ripples more towards the free corner
 */
export function addWind(mat: THREE.Material, mode: Mode, amp: number, height = 1) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    let vs = "uniform float uWindTime;\n" + shader.vertexShader;
    if (mode === "banner") {
      vs = vs.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float bPhase = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 0.4;
        float bFree = clamp(-position.y / ${height.toFixed(3)} * 0.7 + position.x * 0.6, 0.0, 1.4);
        transformed.z += (sin(uWindTime * 3.1 + position.x * 3.0 + position.y * 1.7 + bPhase) * 0.7
                        + sin(uWindTime * 5.3 + position.x * 5.0 + bPhase) * 0.3) * ${amp.toFixed(3)} * bFree;`,
      );
    } else {
      vs = vs.replace(
        "#include <project_vertex>",
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 wOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 wOrigin = vec3(0.0);
        #endif
        float wH = max(position.y / ${height.toFixed(3)}, 0.0);
        float wV = sin(uWindTime * ${mode === "grass" ? "1.9" : "0.9"} + wOrigin.x * 0.35 + wOrigin.z * 0.22) * 0.65
                 + sin(uWindTime * ${mode === "grass" ? "3.3" : "1.7"} + wOrigin.x * 1.1 - wOrigin.z * 0.8) * 0.35;
        float wAmt = wV * ${amp.toFixed(3)} * wH * wH;
        mvPosition.x += wAmt;
        mvPosition.z += wAmt * 0.45;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    }
    shader.vertexShader = vs;
  };
  mat.customProgramCacheKey = () => `wind-${mode}-${amp}-${height}`;
  return mat;
}
