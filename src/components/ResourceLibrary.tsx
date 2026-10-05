import React, { useState, lazy } from 'react';
import { 
  Search, Download,
  Sparkles, GraduationCap, ArrowRight, BookOpen
} from 'lucide-react';
import { RESOURCE_CATALOG } from '../data/landingData';
import { CLASSROOM_ASSIGNMENTS } from '../data/assignments';
import { downloadAssignment } from '../utils/assignmentDocument';
import type { ClassroomAssignment } from '../types/assignment';
import type { ResourceCategory } from '../types';

// Only fetched when a teacher opens a pack preview, keeping the (large) assignment
// renderer and its audio/print helpers out of the initial bundle.
const AssignmentPreview = lazy(() =>
  import('./AssignmentPreview').then((m) => ({ default: m.AssignmentPreview })),
);

export const ResourceLibrary: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<ClassroomAssignment | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const categories: ResourceCategory[] = [
    'All',
    'TOEFL Prep',
    'Grammar & Vocab',
    'Reading & Phonics',
    'Academic Writing',
    'Classroom Games'
  ];

  const filteredResources = RESOURCE_CATALOG.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleDownload = (resourceId: string) => {
    const assignment = CLASSROOM_ASSIGNMENTS[resourceId];
    if (!assignment) return;

    downloadAssignment(assignment, 'student');
    setDownloadFeedback(resourceId);
    window.setTimeout(() => setDownloadFeedback(null), 2500);
  };

  return (
    <section id="resources" className="cmc-section relative scroll-mt-24 bg-slate-950 py-20 sm:py-24 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-xs font-semibold text-cyan-400">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Original, teacher-ready assignments</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Ready for the classroom.
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              Six original assignment packs with clear learning goals, printable student copies, and separate teacher keys. Fifteen TOEFL Junior skill assessments live in their own section below.
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search classroom assignments"
              placeholder="Search by topic, prefix, TOEFL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition shadow-sm"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Resource Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource) => {
            const assignment = CLASSROOM_ASSIGNMENTS[resource.id];
            return (
            <div
              key={resource.id}
              className="group rounded-3xl p-6 bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between hover:-translate-y-1"
            >
              <div>
                {/* Top badges */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                    {resource.tag}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-teal-300">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Teacher key included</span>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition line-clamp-2 mb-2">
                  {resource.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">
                  {resource.description}
                </p>

                {/* Skill tags describe the assignment focus; they are not external certification labels. */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {resource.tags.slice(0, 3).map((tag, i) => (
                    <span 
                      key={`${resource.id}-tag-${i}`} 
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 font-sans">
                    {assignment?.sections.length ?? 0} activities
                  </span>
                  {assignment && <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-950/70 text-teal-300 font-sans">{assignment.gradeBand}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => assignment && setSelectedAssignment(assignment)}
                  disabled={!assignment}
                  className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Preview worksheet</span>
                </button>

                <button
                  onClick={() => handleDownload(resource.id)}
                  disabled={!assignment}
                  aria-label={`${downloadFeedback === resource.id ? 'Downloaded student copy for' : 'Download student copy for'} ${resource.title}`}
                  className={`text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    downloadFeedback === resource.id
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20'
                  } shadow-md`}
                >
                  {downloadFeedback === resource.id ? (
                    <>
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Student copy saved</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download student copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            );
          })}
          {filteredResources.length === 0 && (
            <p className="col-span-full rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
              No assignments match that search. Try a different topic or choose “All”.
            </p>
          )}
        </div>

        {/* Bottom Banner */}
        <div className="mt-14 rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-indigo-950/70 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              Every pack includes a teacher key.
            </h4>
            <p className="text-xs sm:text-sm text-slate-300">
              Preview the challenge, check suggested responses, then print a student copy or download a separate answer key.
            </p>
          </div>
          <button
            onClick={() => CLASSROOM_ASSIGNMENTS['res-1'] && setSelectedAssignment(CLASSROOM_ASSIGNMENTS['res-1'])}
            className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-cyan-500/20 shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span>Preview an assignment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {selectedAssignment && <AssignmentPreview assignment={selectedAssignment} onClose={() => setSelectedAssignment(null)} />}

    </section>
  );
};
