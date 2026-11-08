import React from 'react';

interface CmcLogo3DProps {
  /** Displayed square size in px. */
  size: number;
  /** Number of depth layers stacked along Z (front art is the last one). */
  layers?: number;
  /** Seconds per full revolution — slow, earth-like. */
  dur?: number;
  /** Depth per layer as a fraction of `size`. */
  stepFrac?: number;
  /** How much each deeper layer darkens (per-layer brightness step). */
  dimStep?: number;
  /** 'spin' = full earth-like 360° rotation; 'sway' = gentle ±24° 3D sway
   *  that never turns the logo edge-on (best below ~60px). */
  mode?: 'spin' | 'sway';
}

/**
 * Official CMC "M" monogram as a slowly spinning 3D slab.
 *
 * Pure CSS 3D: the transparent logo PNG is stacked `layers` times along Z
 * inside a preserve-3d container that rotates around the vertical axis
 * forever (like the earth), with a slight axial tilt on the wrapper. Deeper
 * layers darken progressively so the stack reads as real extruded depth on
 * every angle. No WebGL, no JS per frame — one CSS animation per instance.
 * Respects prefers-reduced-motion (renders the static front layer).
 */
export const CmcLogo3D: React.FC<CmcLogo3DProps> = ({
  size,
  layers = 9,
  dur = 18,
  stepFrac = 0.024,
  dimStep,
  mode = 'spin',
}) => {
  const indices = Array.from({ length: layers }, (_, i) => i);
  const dim = dimStep ?? 0.5 / Math.max(1, layers - 1);
  return (
    <div
      className="cmc-logo3d"
      role="img"
      aria-label="CMC logo"
      style={
        {
          '--s': `${size}px`,
          '--n': layers,
          '--dur': `${dur}s`,
          '--step': `${(size * stepFrac).toFixed(2)}px`,
          '--dim': dim.toFixed(4),
        } as React.CSSProperties
      }
    >
      <div className="cmc-logo3d-tilt">
        <div className={mode === 'sway' ? 'cmc-logo3d-spin cmc-logo3d-spin--sway' : 'cmc-logo3d-spin'}>
          {indices.map((i) => (
            <img
              key={i}
              src="./images/cmc-m-logo-420.png"
              alt=""
              width={size}
              height={size}
              loading="eager"
              draggable={false}
              className="cmc-logo3d-layer"
              style={{ '--i': i } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
