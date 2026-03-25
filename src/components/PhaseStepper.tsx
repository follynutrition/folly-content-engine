import { PHASES } from '@/lib/types';
import { getSegment } from '@/lib/config';
import { useStore } from '@/lib/store';
import {
  MagnifyingGlass,
  PencilSimpleLine,
  CheckCircle,
  Rocket,
} from '@phosphor-icons/react';

const phaseIcons = [MagnifyingGlass, PencilSimpleLine, CheckCircle, Rocket];

interface PhaseStepperProps {
  segmentId: string;
  currentPhase: number;
  onPhaseClick: (phase: number) => void;
}

export function PhaseStepper({ segmentId, currentPhase, onPhaseClick }: PhaseStepperProps) {
  const segment = getSegment(segmentId);
  const { state } = useStore();
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const color = segment?.color ?? '#E8457A';

  const topicCount = segState?.topics?.length ?? 0;
  const packageCount = segState?.packages?.length ?? 0;
  const approvedCount = segState?.packages?.filter(p => p.status === 'approved' || p.status === 'published').length ?? 0;

  const phaseCounts: Record<number, string> = {
    0: topicCount > 0 ? `${topicCount}` : '',
    1: packageCount > 0 ? `${packageCount}` : '',
    2: packageCount > 0 ? `${approvedCount}/${packageCount}` : '',
    3: approvedCount > 0 ? `${approvedCount}` : '',
  };

  return (
    <div className="flex items-center px-6 py-2.5 gap-0 border-b border-neutral-200 bg-white/80 overflow-x-auto sticky top-[43px] z-10 backdrop-blur-md">
      {PHASES.map((phase, i) => {
        const active = i === currentPhase;
        const complete = i < currentPhase;
        const future = i > currentPhase;
        const Icon = phaseIcons[i];
        const count = phaseCounts[i];

        return (
          <div key={phase.id} className="flex items-center">
            <div
              onClick={() => { if (complete) onPhaseClick(i); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                complete ? 'cursor-pointer hover:bg-neutral-100' : ''
              } ${future ? 'opacity-30' : ''}`}
              style={active ? {
                backgroundColor: `${color}0A`,
                border: `1px solid ${color}20`,
              } : { border: '1px solid transparent' }}
            >
              <div
                className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] transition-all duration-200"
                style={{
                  backgroundColor: complete ? color : active ? `${color}15` : 'var(--color-neutral-100)',
                  color: complete ? '#fff' : active ? color : 'var(--color-neutral-400)',
                }}
              >
                {complete ? (
                  <CheckCircle weight="bold" size={13} />
                ) : (
                  <Icon size={13} weight={active ? 'bold' : 'regular'} />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[12px] font-semibold leading-tight"
                  style={{
                    color: active ? 'var(--color-neutral-900)' : complete ? color : 'var(--color-neutral-400)',
                  }}
                >
                  {phase.label}
                </span>
                {count && (
                  <span
                    className="text-[10px] font-mono px-1.5 py-px rounded-[4px] leading-none"
                    style={{
                      backgroundColor: active ? `${color}12` : complete ? `${color}0A` : 'var(--color-neutral-100)',
                      color: active ? color : complete ? color : 'var(--color-neutral-400)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </div>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className="w-5 h-px mx-0.5"
                style={{ backgroundColor: complete ? color : 'var(--color-neutral-200)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
