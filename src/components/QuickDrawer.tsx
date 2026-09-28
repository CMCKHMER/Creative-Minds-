import React, { useState, useEffect } from 'react';
import { 
  X, Search, Sparkles, GraduationCap, FileSpreadsheet, 
  UploadCloud, Type, Users, BarChart3, Gamepad2, 
  Baby, BookOpen, Languages, ArrowUpRight, CheckCircle2, ClipboardCheck
} from 'lucide-react';
import { QUICK_LINKS } from '../data/landingData';

interface QuickDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (toolId: string) => void;
}

export const QuickDrawer: React.FC<QuickDrawerProps> = ({
  isOpen,
  onClose,
  onSelectAction
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const getIcon = (iconName: string) => {
    const props = { className: "w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" };
    switch (iconName) {
      case 'GraduationCap': return <GraduationCap {...props} />;
      case 'Sparkles': return <Sparkles {...props} />;
      case 'FileSpreadsheet': return <FileSpreadsheet {...props} />;
      case 'ClipboardCheck': return <ClipboardCheck {...props} />;
      case 'UploadCloud': return <UploadCloud {...props} />;
      case 'Type': return <Type {...props} />;
      case 'Users': return <Users {...props} />;
      case 'BarChart3': return <BarChart3 {...props} />;
      case 'Gamepad2': return <Gamepad2 {...props} />;
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
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-slate-900/95 border-r border-slate-800 shadow-2xl flex flex-col z-10 backdrop-blur-xl animate-in slide-in-from-left duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white">
              CMC
            </div>
            <div>
              <h2 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
                Quick Links
                <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-full font-semibold">
                  Command Center
                </span>
              </h2>
               <p className="text-xs text-slate-400">Assessments, assignments & student games</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close Quick Links"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800/60 bg-slate-900/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tools, assessments, games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              autoFocus
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Links List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredLinks.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No matching teacher tools found.</p>
              <button
                onClick={() => setSearchTerm('')}
                className="mt-2 text-xs text-cyan-400 underline font-medium"
              >
                Reset search
              </button>
            </div>
          ) : (
            filteredLinks.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelectAction(item.id);
                  onClose();
                }}
                className="w-full group text-left p-3 rounded-xl bg-slate-950/40 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/40 transition flex items-start gap-3 relative cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 group-hover:border-cyan-500/50 group-hover:bg-cyan-950/20 transition-all shrink-0 mt-0.5">
                  {getIcon(item.iconName)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition truncate">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 group-hover:text-slate-300">
                    {item.description}
                  </p>
                  <span className="inline-block text-[10px] text-slate-500 mt-1 uppercase font-semibold tracking-wider">
                    {item.category}
                  </span>
                </div>

                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition shrink-0 opacity-0 group-hover:opacity-100" />
              </button>
            ))
          )}
        </div>

        {/* Footer info in drawer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
             <span>Original classroom practice content</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>CMC Network practice preview</span>
            <span>Original learning materials</span>
          </div>
        </div>

      </div>
    </div>
  );
};
