import React, { useCallback, useState } from 'react';
import {
  ArrowUpRight,
  Brain,
  ChevronDown,
  Globe2,
  LineChart,
  Sparkles,
  BookOpenCheck,
  Cpu,
} from 'lucide-react';
import { AI_FUTURE_CARDS, type AiFutureCard } from '../data/aiFutureCards';

const CARD_ICONS: Record<AiFutureCard['icon'], React.ComponentType<{ className?: string }>> = {
  book: BookOpenCheck,
  brain: Brain,
  chart: LineChart,
  globe: Globe2,
};

interface AiFutureShowcaseProps {
  /** 'home' renders as a full standalone band below the directory;
   *  'embedded' fits cleanly inside another page such as #features. */
  variant?: 'home' | 'embedded';
}

export const AiFutureShowcase: React.FC<AiFutureShowcaseProps> = ({ variant = 'home' }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 11;
    const rotateX = (0.5 - py) * 9;
    el.style.setProperty('--holo-rx', `${rotateX.toFixed(2)}deg`);
    el.style.setProperty('--holo-ry', `${rotateY.toFixed(2)}deg`);
    el.style.setProperty('--holo-gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--holo-gy', `${(py * 100).toFixed(1)}%`);
  }, []);

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    el.style.setProperty('--holo-rx', '0deg');
    el.style.setProperty('--holo-ry', '0deg');
    el.style.setProperty('--holo-gx', '50%');
    el.style.setProperty('--holo-gy', '35%');
  }, []);

  const headingId = variant === 'home' ? 'ai-future-heading' : 'ai-future-embedded-heading';

  return (
    <section
      aria-labelledby={headingId}
      className={`cmc-ai-showcase ${variant === 'embedded' ? 'cmc-ai-showcase--embedded' : ''}`}
    >
      {/* Ambient holographic aurora backdrop */}
      <div className="cmc-ai-aurora" aria-hidden="true" />

      <div className="cmc-ai-inner">
        {/* Futuristic Header */}
        <header className="cmc-ai-header">
          <div className="cmc-ai-eyebrow">
            <span className="cmc-ai-beacon" aria-hidden="true" />
            <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
            <span>AI-INTEGRATED ROADMAP · COMING SOON</span>
          </div>

          <h2 id={headingId} className="cmc-ai-title">
            Education <span className="cmc-ai-title-glow">Reimagined</span>
          </h2>

          <p className="cmc-ai-motto" aria-label="Intelligent, Immersive, Inclusive">
            <span>INTELLIGENT</span>
            <span className="cmc-ai-dot" aria-hidden="true">·</span>
            <span>IMMERSIVE</span>
            <span className="cmc-ai-dot" aria-hidden="true">·</span>
            <span>INCLUSIVE</span>
          </p>

          <p className="cmc-ai-subtitle">
            Creative Minds Cambodia is evolving into a next-generation AI-integrated learning
            platform. Preview the intelligent capabilities arriving on top of our live classroom
            tools.
          </p>

          {/* Four Vision Pillars strip */}
          <div className="cmc-ai-pillars" role="list" aria-label="Upcoming AI pillars">
            {AI_FUTURE_CARDS.map((card) => (
              <span key={card.id} role="listitem" className="cmc-ai-pillar-pill">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {card.pillar}
              </span>
            ))}
          </div>
        </header>

        {/* 4 Futuristic Floating-3D Holographic Cards */}
        <div className="cmc-ai-grid">
          {AI_FUTURE_CARDS.map((card, index) => {
            const Icon = CARD_ICONS[card.icon];
            const isExpanded = expandedId === card.id;

            return (
              <article
                key={card.id}
                data-tone={card.tone}
                style={{ '--float-delay': `${index * -1.35}s` } as React.CSSProperties}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                className={`cmc-holo-card ${isExpanded ? 'is-expanded' : ''}`}
              >
                {/* Dynamic cursor specular glare */}
                <div className="cmc-holo-glare" aria-hidden="true" />
                {/* Iridescent top laser edge */}
                <div className="cmc-holo-rim" aria-hidden="true" />

                {/* Floating 3D Hologram Projection Chamber (always dark cosmic optical stage) */}
                <div className="cmc-holo-stage" data-keep-dark="">
                  {/* Subtle cosmic grid + floor emitter */}
                  <div className="cmc-holo-grid-floor" aria-hidden="true" />
                  <div className="cmc-holo-orbit-ring" aria-hidden="true" />
                  <div className="cmc-holo-emitter-glow" aria-hidden="true" />

                  {/* Top status HUD row inside stage */}
                  <div className="cmc-holo-hud">
                    <span className="cmc-holo-phase">
                      <span className="cmc-holo-pulse" aria-hidden="true" />
                      {card.phase}
                    </span>
                    <span className="cmc-holo-soon">AI SOON</span>
                  </div>

                  {/* Levitating 3D Holographic Wireframe Image */}
                  <div className="cmc-holo-float-wrap">
                    <img
                      src={card.image}
                      alt={card.imageAlt}
                      width={960}
                      height={540}
                      loading="lazy"
                      decoding="async"
                      className="cmc-holo-art"
                    />
                  </div>
                </div>

                {/* Card Content Body */}
                <div className="cmc-holo-body">
                  <div className="cmc-holo-kicker-row">
                    <span className="cmc-holo-icon" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="cmc-holo-pillar">{card.pillar}</span>
                  </div>

                  <h3 className="cmc-holo-title">{card.title}</h3>
                  <p className="cmc-holo-summary">{card.summary}</p>

                  {/* Capability Chips */}
                  <div className="cmc-holo-tags">
                    {card.tags.map((tag) => (
                      <span key={tag} className="cmc-holo-tag">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Expandable AI Integration Preview */}
                  {isExpanded && (
                    <div
                      id={`ai-blueprint-${card.id}`}
                      className="cmc-holo-blueprint"
                    >
                      <div className="cmc-holo-blueprint-row">
                        <span className="cmc-holo-bp-label">Live Today</span>
                        <p className="cmc-holo-bp-text">{card.todayState}</p>
                      </div>
                      <div className="cmc-holo-blueprint-row cmc-holo-blueprint-row--ai">
                        <span className="cmc-holo-bp-label">AI Upgrade</span>
                        <p className="cmc-holo-bp-text">{card.aiNextState}</p>
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="cmc-holo-actions">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`ai-blueprint-${card.id}`}
                      onClick={() => setExpandedId(isExpanded ? null : card.id)}
                      className="cmc-holo-preview-btn"
                    >
                      <span>{isExpanded ? 'Hide blueprint' : 'AI preview'}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <a href={card.liveHref} className="cmc-holo-live-link">
                      <span>{card.liveLabel}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AiFutureShowcase;
