import { getSegment } from '@/lib/config';
import { useStore } from '@/lib/store';
import { PHASES } from '@/lib/types';
import { CaretRight } from '@phosphor-icons/react';

interface BreadcrumbProps {
  segmentId: string;
  currentPhase: number;
}

export function Breadcrumb({ segmentId, currentPhase }: BreadcrumbProps) {
  const segment = getSegment(segmentId);
  const { state } = useStore();
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const phaseLabel = PHASES[Math.min(currentPhase, 3)]?.label ?? '';
  const packageCount = segState?.packages?.length ?? 0;
  const topicCount = segState?.topics?.length ?? 0;

  let detail = '';
  if (currentPhase === 0 && topicCount > 0) detail = `${topicCount} topics`;
  if (currentPhase === 1 && packageCount > 0) detail = `${packageCount} packages`;
  if (currentPhase === 2 && packageCount > 0) {
    const pending = segState?.packages?.filter(p => p.status === 'pending' || p.status === 'needs_edit').length ?? 0;
    detail = `${pending} to review`;
  }
  if (currentPhase === 3) {
    const approved = segState?.packages?.filter(p => p.status === 'approved').length ?? 0;
    detail = `${approved} ready`;
  }

  return (
    <div className="px-6 py-1.5 bg-neutral-50 border-b border-neutral-100 flex items-center gap-1.5 text-[11px] text-neutral-400">
      <span className="font-medium" style={{ color: segment?.color }}>{segment?.name}</span>
      <CaretRight size={9} className="text-neutral-300" />
      <span className="text-neutral-500">{phaseLabel}</span>
      {detail && (
        <>
          <CaretRight size={9} className="text-neutral-300" />
          <span className="font-mono text-neutral-400">{detail}</span>
        </>
      )}
    </div>
  );
}
