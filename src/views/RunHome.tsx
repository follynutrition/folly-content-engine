import { segments } from '@/lib/config';
import { useStore } from '@/lib/store';
import { PHASES } from '@/lib/types';
import type { ContentPackage } from '@/lib/types';
import { CheckCircle, Clock, Warning } from '@phosphor-icons/react';

interface RunHomeProps {
  onSegmentSelect: (id: string) => void;
}

const PHASE_CTAS: Record<number, string> = {
  0: 'Research & Topics',
  1: 'Generate Content & Images',
  2: 'Review Packages',
  3: 'Publish',
};

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getLatestTimestamp(packages: ContentPackage[]): string | null {
  // ContentPackage has no explicit timestamp field, so we skip this if unavailable
  return null;
}

export function RunHome({ onSegmentSelect }: RunHomeProps) {
  const { state } = useStore();
  const run = state.runs[state.activeRunId];

  // Count segments at each phase for batch nudge
  const phaseCounts: Record<number, number> = {};
  for (const seg of segments) {
    const phase = run?.segments[seg.id]?.phase ?? 0;
    phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
  }

  // Find batch nudge opportunity
  const batchPhase = Object.entries(phaseCounts).find(
    ([phase, count]) => count >= 3 && Number(phase) >= 2 && Number(phase) <= 4
  );

  // Global stats across all segments
  const stats = segments.reduce((acc, seg) => {
    const segState = run?.segments[seg.id];
    const pkgs = segState?.packages ?? [];
    acc.total += pkgs.length;
    acc.approved += pkgs.filter(p => p.status === 'approved').length;
    acc.pending += pkgs.filter(p => p.status === 'pending' || p.status === 'needs_edit').length;
    acc.flagged += pkgs.filter(p => p.complianceFlags?.some(f => f.severity === 'hard')).length;
    acc.published += pkgs.filter(p => p.status === 'published').length;
    return acc;
  }, { total: 0, approved: 0, pending: 0, flagged: 0, published: 0 });

  const progressPct = stats.total > 0
    ? Math.round(((stats.approved + stats.published) / stats.total) * 100)
    : 0;

  return (
    <div className="max-w-[700px] mx-auto py-10">
      <h1 className="text-[26px] font-semibold mb-1">{run?.label ?? 'March 2026'}</h1>
      <p className="text-neutral-500 text-sm mb-1">
        Content Engine · {segments.length} segments · <span className="font-mono text-[10px] text-neutral-600">⌘K search</span>
      </p>

      {/* Global summary stats bar */}
      {stats.total > 0 && (
        <div className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-5 mt-4 mb-6">
          <div className="flex items-center gap-8 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} weight="fill" className="text-success" />
              <span className="font-mono text-[13.5px] text-neutral-50">{stats.approved}</span>
              <span className="text-[11px] text-neutral-400">Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={18} weight="fill" className="text-warning" />
              <span className="font-mono text-[13.5px] text-neutral-50">{stats.pending}</span>
              <span className="text-[11px] text-neutral-400">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <Warning size={18} weight="fill" className="text-error" />
              <span className="font-mono text-[13.5px] text-neutral-50">{stats.flagged}</span>
              <span className="text-[11px] text-neutral-400">Flagged</span>
            </div>
            <div className="ml-auto">
              <span className="font-mono text-[13.5px] text-neutral-50">{progressPct}%</span>
              <span className="text-[11px] text-neutral-400 ml-1.5">complete</span>
            </div>
          </div>
          {/* Overall progress bar */}
          <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-400 bg-success"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {stats.total === 0 && <div className="mb-6 mt-4" />}

      {batchPhase && (
        <div className="mb-6 p-4 rounded-xl border border-primary-500/20 bg-primary-500/5">
          <p className="text-sm text-neutral-300">
            <span className="text-primary-400 font-semibold">{batchPhase[1]} segments</span>{' '}
            ready for {PHASES[Number(batchPhase[0])]?.label?.toLowerCase()} — batch process?
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {segments.map(s => {
          const segState = run?.segments[s.id];
          const phase = segState?.phase ?? 0;
          const phaseInfo = PHASES[Math.min(phase, 3)];
          const pct = (phase / 4) * 100;
          const done = phase >= 4;

          const pkgs = segState?.packages ?? [];
          const topics = segState?.topics ?? [];
          const segApproved = pkgs.filter(p => p.status === 'approved' || p.status === 'published').length;
          const segTotal = pkgs.length;
          const topicCount = topics.length;
          const lastTs = getLatestTimestamp(pkgs);

          return (
            <div
              key={s.id}
              onClick={() => onSegmentSelect(s.id)}
              className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-[18px_20px] cursor-pointer transition-[border-color] duration-150 hover:border-neutral-600"
              style={{ borderLeftWidth: 3, borderLeftColor: done ? 'var(--color-success)' : s.color }}
            >
              <div className="flex justify-between items-center mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-[9px] h-[9px] rounded-full"
                    style={{ backgroundColor: done ? 'var(--color-success)' : s.color }}
                  />
                  <span className="text-base font-semibold">{s.name}</span>
                  {/* Segment counts */}
                  {(topicCount > 0 || segTotal > 0) && (
                    <span className="text-[11px] text-neutral-500 font-mono ml-1">
                      {topicCount > 0 && `${topicCount} topics`}
                      {topicCount > 0 && segTotal > 0 && ' · '}
                      {segTotal > 0 && `${segTotal} pkg${segTotal !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>
                {done ? (
                  <span className="text-[10px] font-mono tracking-wide px-[7px] py-[1px] rounded-full bg-success/12 text-success">
                    ✓ published
                  </span>
                ) : (
                  <button
                    className="text-white text-xs font-semibold px-4 py-[7px] rounded-[10px] border-none cursor-pointer transition-[filter] duration-150 hover:brightness-110"
                    style={{ backgroundColor: s.color }}
                    onClick={(e) => { e.stopPropagation(); onSegmentSelect(s.id); }}
                  >
                    {PHASE_CTAS[phase] ?? 'Continue'} →
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-1 bg-neutral-700 rounded-sm">
                  <div
                    className="h-full rounded-sm transition-[width] duration-400"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: done ? 'var(--color-success)' : s.color,
                    }}
                  />
                </div>
                {/* Mini progress indicator */}
                {segTotal > 0 && (
                  <span className="text-[11px] text-neutral-500 font-mono min-w-[70px] text-right">
                    {segApproved}/{segTotal} approved
                  </span>
                )}
                <span className="text-[11px] text-neutral-600 font-mono min-w-[80px] text-right">
                  {done ? 'Complete' : `Phase ${phase + 1}: ${phaseInfo?.label}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
