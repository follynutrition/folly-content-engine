import { segments } from '@/lib/config';
import { useStore } from '@/lib/store';
import { PHASES } from '@/lib/types';
import { ArrowRight, Sparkle } from '@phosphor-icons/react';

interface RunHomeProps {
  onSegmentSelect: (id: string) => void;
}

const PHASE_VERBS: Record<number, (ctx: { topics: number; packages: number; approved: number }) => string> = {
  0: () => 'Start Research',
  1: ({ topics }) => `Generate from ${topics} topic${topics !== 1 ? 's' : ''}`,
  2: ({ packages }) => `Review ${packages} package${packages !== 1 ? 's' : ''}`,
  3: ({ approved }) => `Publish ${approved} approved`,
};

export function RunHome({ onSegmentSelect }: RunHomeProps) {
  const { state } = useStore();
  const run = state.runs[state.activeRunId];

  // Global stats
  const stats = segments.reduce((acc, seg) => {
    const segState = run?.segments[seg.id];
    const pkgs = segState?.packages ?? [];
    acc.total += pkgs.length;
    acc.approved += pkgs.filter(p => p.status === 'approved').length;
    acc.pending += pkgs.filter(p => p.status === 'pending' || p.status === 'needs_edit').length;
    acc.published += pkgs.filter(p => p.status === 'published').length;
    return acc;
  }, { total: 0, approved: 0, pending: 0, published: 0 });

  const completedSegments = segments.filter(s => (run?.segments[s.id]?.phase ?? 0) >= 4).length;
  const isFirstRun = stats.total === 0 && completedSegments === 0;

  // Batch nudge: 3+ segments at the same advanced phase
  const phaseCounts: Record<number, string[]> = {};
  for (const seg of segments) {
    const phase = run?.segments[seg.id]?.phase ?? 0;
    if (phase >= 2 && phase < 4) {
      phaseCounts[phase] = phaseCounts[phase] ?? [];
      phaseCounts[phase].push(seg.name);
    }
  }
  const batchNudge = Object.entries(phaseCounts).find(([, names]) => names.length >= 3);

  return (
    <div className="max-w-[700px] mx-auto py-10">
      {/* Header */}
      <h1 className="text-[26px] font-semibold mb-1">{run?.label ?? 'March 2026'}</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {segments.length} segments · {completedSegments}/{segments.length} complete
      </p>

      {/* First-run empty state */}
      {isFirstRun && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6 text-center">
          <Sparkle size={32} weight="duotone" className="mx-auto mb-3 text-primary-400" />
          <h2 className="text-lg font-semibold mb-1.5">Start your content run</h2>
          <p className="text-sm text-neutral-500 leading-relaxed max-w-md mx-auto mb-4">
            Pick a segment below to begin. Each segment flows through research, content generation, review, and publishing.
          </p>
        </div>
      )}

      {/* Progress summary — only when there's data */}
      {stats.total > 0 && (
        <div className="flex items-center gap-6 mb-6 px-1">
          {/* Progress ring */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
              <circle cx="28" cy="28" r="24" fill="none" stroke="var(--color-neutral-200)" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24" fill="none"
                stroke="var(--color-success)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${((stats.approved + stats.published) / stats.total) * 150.8} 150.8`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-mono font-semibold text-neutral-900">
                {Math.round(((stats.approved + stats.published) / stats.total) * 100)}%
              </span>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-mono text-neutral-900">{stats.approved + stats.published}</span>
              <span className="text-neutral-400 ml-1.5">approved</span>
            </div>
            <div>
              <span className="font-mono text-neutral-900">{stats.pending}</span>
              <span className="text-neutral-400 ml-1.5">pending</span>
            </div>
            <div>
              <span className="font-mono text-neutral-900">{stats.total}</span>
              <span className="text-neutral-400 ml-1.5">total</span>
            </div>
          </div>
        </div>
      )}

      {/* Batch nudge */}
      {batchNudge && (
        <div className="mb-5 p-4 rounded-xl border border-primary-500/25 bg-primary-500/5 flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            <span className="text-primary-400 font-semibold">{batchNudge[1].length} segments</span>{' '}
            ready for {PHASES[Number(batchNudge[0])]?.label?.toLowerCase()}
          </p>
          <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-primary-500 text-white border-none cursor-pointer hover:brightness-110 transition-[filter]">
            Batch {PHASES[Number(batchNudge[0])]?.label} →
          </button>
        </div>
      )}

      {/* Segment cards */}
      <div className="flex flex-col gap-3">
        {segments.map(s => {
          const segState = run?.segments[s.id];
          const phase = segState?.phase ?? 0;
          const done = phase >= 4;
          const pct = (phase / 4) * 100;

          const pkgs = segState?.packages ?? [];
          const topics = segState?.topics ?? [];
          const approved = pkgs.filter(p => p.status === 'approved' || p.status === 'published').length;

          const ctaText = done
            ? 'Complete'
            : PHASE_VERBS[phase]?.({ topics: topics.length, packages: pkgs.length, approved }) ?? 'Continue';

          return (
            <div
              key={s.id}
              onClick={() => onSegmentSelect(s.id)}
              className="bg-white rounded-xl border border-neutral-200 p-5 cursor-pointer transition-all duration-150 hover:border-neutral-300 hover:bg-neutral-50 group"
              style={{ borderLeftWidth: 3, borderLeftColor: done ? 'var(--color-success)' : s.color }}
            >
              {/* Top row: name + CTA */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: done ? 'var(--color-success)' : s.color }}
                    />
                    <span className="text-[15px] font-semibold">{s.name}</span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed ml-5">
                    {s.description}
                  </p>
                </div>

                {done ? (
                  <span className="text-[10px] font-mono tracking-wide px-2.5 py-1 rounded-full bg-success/12 text-success flex-shrink-0">
                    published
                  </span>
                ) : (
                  <button
                    className="text-white text-xs font-semibold px-4 py-2 rounded-lg border-none cursor-pointer transition-all duration-150 hover:brightness-110 flex items-center gap-1.5 flex-shrink-0 group-hover:brightness-105"
                    style={{ backgroundColor: s.color }}
                    onClick={(e) => { e.stopPropagation(); onSegmentSelect(s.id); }}
                  >
                    {ctaText} <ArrowRight size={12} weight="bold" />
                  </button>
                )}
              </div>

              {/* Bottom row: progress bar + stats */}
              <div className="flex items-center gap-3 ml-5 mt-3">
                <div className="flex-1 h-1 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-400"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: done ? 'var(--color-success)' : s.color,
                    }}
                  />
                </div>
                <span className="text-[11px] text-neutral-400 font-mono min-w-[50px] text-right">
                  {done ? '4/4' : `${phase}/4`}
                </span>
                {pkgs.length > 0 && (
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {approved}/{pkgs.length} pkg
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
