import { useEffect, useState } from 'react';

/**
 * Official CMC logo — the spinning coin, cut out of the teacher's 360°
 * spin video (crop scripts/make_spinning_logo.py: 640×640 around the disc
 * at (362, 578), watermarks excluded, audio stripped, 190-frame loop).
 * Renders as a circular medallion (rounded-full mask) at the caller's size.
 * Under prefers-reduced-motion the coin does not spin — the video stays on
 * its face-on poster frame instead.
 */
export function SpinLogo({ size, className = '' }: { size: number; className?: string }) {
  const [spin, setSpin] = useState(true);
  useEffect(() => {
    setSpin(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  return (
    <video
      autoPlay={spin}
      loop={spin}
      muted
      playsInline
      poster="./images/cmc-spin-logo-poster.jpg"
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className={`rounded-full object-cover drop-shadow-[0_0_12px_rgba(56,189,248,0.35)] transition-transform group-hover:scale-105 ${className}`}
    >
      <source src="./images/cmc-spin-logo.webm" type="video/webm" />
      <source src="./images/cmc-spin-logo.mp4" type="video/mp4" />
    </video>
  );
}
