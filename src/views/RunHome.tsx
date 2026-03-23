import { segments } from '@/lib/config';
import { useStore } from '@/lib/store';
import { PHASES } from '@/lib/types';

interface RunHomeProps {
  onSegmentSelect: (id: string) => void;
}

const PHASE_CTAS: Record<number, string> = {
  0: 'Research & Topics',
  1: 'Generate Content & Images',
  2: 'Review Packages',
  3: 'Publish',
};

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
    acc.flagged += pkgs.filter(p => p.complianceFlags?.length > 0).length;
    acc.published += pkgs.filter(p => p.status === 'published').length;
    return acc;
  }, { total: 0, approved: 0, pending: 0, flagged: 0, published: 0 });

  return (
    <div className="max-w-[700px] mx-auto py-10">
      <h1 className="text-[26px] font-semibold mb-1">{run?.label ?? 'March 2026'}</h1>
      <p className="text-neutral-500 text-sm mb-1">
        Content Engine · 4 segments · <span className="font-mono text-[10px] text-neutral-600">⌘K search</span>
      </p>

      {/* Global stats bar */}
      {stats.total > 0 && (
        <div className="flex gap-6 mb-6 mt-3">
          <div>
            <div className="text-2xl font-bold text-neutral-50 font-mono">{stats.approved}</div>
            <div className="text-[10px] text-neutral-500 font-mono tracking-wide">APPROVED</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning font-mono">{stats.pending}</div>
            <div className="text-[10px] text-neutral-500 font-mono tracking-wide">PENDING</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-error font-mono">{stats.flagged}</div>
            <div className="text-[10px] text-neutral-500 font-mono tracking-wide">FLAGGED</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success font-mono">{stats.total}</div>
            <div className="text-[10px] text-neutral-500 font-mono tracking-wide">TOTAL</div>
          </div>
        </div>
      )}

      {stats.total === 0 && <div className="mb-6" />}

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
                <div className="flex-1 h-1 bg-neutral-800 rounded-sm">
                  <div
                    className="h-full rounded-sm transition-[width] duration-400"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: done ? 'var(--color-success)' : s.color,
                    }}
                  />
                </div>
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
