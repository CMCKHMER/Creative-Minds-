import React, { useState, useEffect } from 'react';
import {
  X, Search, Sparkles, GraduationCap, FileSpreadsheet,
  UploadCloud, Type, Users, BarChart3, Gamepad2,
  Baby, BookOpen, Languages, ArrowUpRight, CheckCircle2, ClipboardCheck,
  Brain, CalendarCheck
} from 'lucide-react';
import { QUICK_LINKS } from '../data/landingData';

interface QuickDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (toolId: string) => void;
}

type AccentTone = 'sapphire' | 'violet' | 'emerald' | 'amber';

function toneForCategory(category: string): AccentTone {
  const c = category.toLowerCase();
  if (c.includes('game') || c.includes('arcade') || c.includes('vocab')) return 'violet';
  if (c.includes('curriculum') || c.includes('kid') || c.includes('record')) return 'emerald';
  if (c.includes('resource') || c.includes('teacher')) return 'amber';
  return 'sapphire';
}

export const QuickDrawer: React.FC<QuickDrawerProps> = ({
  isOpen,
  onClose,
  onSelectAction
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Close on escape key & lock background scroll without clobbering overflow-x
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const getIcon = (iconName: string) => {
    const props = { className: 'cmc-qdrawer-icon-svg w-4 h-4 transition-transform duration-200 group-hover:scale-110' };
    switch (iconName) {
      case 'GraduationCap': return <GraduationCap {...props} />;
      case 'Sparkles': return <Sparkles {...props} />;
      case 'FileSpreadsheet': return <FileSpreadsheet {...props} />;
      case 'ClipboardCheck': return <ClipboardCheck {...props} />;
      case 'CalendarCheck': return <CalendarCheck {...props} />;
      case 'UploadCloud': return <UploadCloud {...props} />;
      case 'Type': return <Type {...props} />;
      case 'Users': return <Users {...props} />;
      case 'BarChart3': return <BarChart3 {...props} />;
      case 'Gamepad2': return <Gamepad2 {...props} />;
      case 'Brain': return <Brain {...props} />;
      case 'Baby': return <Baby {...props} />;
      case 'BookOpen': return <BookOpen {...props} />;
      case 'Languages': return <Languages {...props} />;
      default: return <Sparkles {...props} />;
    }
  };

  const filteredLinks = QUICK_LINKS.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Quick Links Command Center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="cmc-qdrawer-backdrop fixed inset-0 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel — matches both dark smoked-glass and html.light milk-glass themes */}
      <div className="cmc-qdrawer-panel relative h-[100dvh] w-full max-w-md flex flex-col z-10 backdrop-blur-2xl overscroll-contain animate-in slide-in-from-left duration-300">

        {/* Header */}
        <div className="cmc-qdrawer-header shrink-0 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="cmc-qdrawer-logo w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs tracking-tight text-white shrink-0">
              CMC
            </div>
            <div className="min-w-0">
              <h2 className="cmc-qdrawer-heading font-bold text-base tracking-tight flex items-center gap-2 flex-wrap">
                Quick Links
                <span className="cmc-qdrawer-pill text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
                  Command Center
                </span>
              </h2>
              <p className="cmc-qdrawer-sub text-xs truncate">Assessments, assignments &amp; student games</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cmc-qdrawer-close min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition shrink-0"
            aria-label="Close Quick Links"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="cmc-qdrawer-search-wrap shrink-0 px-4 py-3">
          <div className="relative">
            <Search className="cmc-qdrawer-search-icon w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tools, assessments, games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="cmc-qdrawer-search w-full pl-10 pr-14 py-2.5 text-xs rounded-xl focus:outline-none transition"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="cmc-qdrawer-clear absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Links List — sculpted tactile 3D button cards */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3">
          {filteredLinks.length === 0 ? (
            <div className="py-12 text-center">
              <p className="cmc-qdrawer-sub text-sm">No matching teacher tools found.</p>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="cmc-qdrawer-reset mt-2 text-xs underline font-semibold"
              >
                Reset search
              </button>
            </div>
          ) : (
            filteredLinks.map((item) => {
              const tone = toneForCategory(item.category);
              return (
                <button
                  type="button"
                  key={item.id}
                  data-tone={tone}
                  onClick={() => {
                    onSelectAction(item.id);
                    onClose();
                  }}
                  className="cmc-qdrawer-btn w-full group text-left p-3.5 rounded-2xl flex items-start gap-3.5 relative cursor-pointer select-none"
                >
                  <div className="cmc-qdrawer-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(item.iconName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="cmc-qdrawer-title text-[13px] font-bold tracking-tight transition truncate">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="cmc-qdrawer-badge text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="cmc-qdrawer-desc text-[11.5px] line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                    <span className="cmc-qdrawer-cat inline-block text-[9.5px] mt-1.5 uppercase font-bold tracking-[0.12em]">
                      {item.category}
                    </span>
                  </div>

                  <ArrowUpRight className="cmc-qdrawer-arrow w-4 h-4 transition-all duration-200 shrink-0 mt-0.5" aria-hidden="true" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info in drawer */}
        <div className="cmc-qdrawer-footer shrink-0 px-4 pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2">
          <div className="cmc-qdrawer-sub flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Original classroom practice content</span>
          </div>
          <div className="cmc-qdrawer-foot-meta flex items-center justify-between text-[11px] pt-0.5">
            <span>CMC Network practice preview</span>
            <span>Original learning materials</span>
          </div>
        </div>

      </div>
    </div>
  );
};
