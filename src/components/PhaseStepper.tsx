import { PHASES } from '@/lib/types';
import { getSegment } from '@/lib/config';
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
  const color = segment?.color ?? '#E8457A';

  return (
    <div className="flex items-center px-6 py-3 gap-0 border-b border-neutral-800 bg-neutral-900 overflow-x-auto sticky top-[47px] z-10 backdrop-blur-sm">
      {PHASES.map((phase, i) => {
        const active = i === currentPhase;
        const complete = i < currentPhase;
        const future = i > currentPhase;
        const Icon = phaseIcons[i];

        return (
          <div key={phase.id} className="flex items-center">
            <div
              onClick={() => { if (complete) onPhaseClick(i); }}
              className={`flex items-center gap-[7px] px-3 py-1.5 rounded-lg transition-all duration-200 ${
                complete ? 'cursor-pointer hover:bg-white/5' : ''
              } ${future ? 'opacity-30' : ''}`}
              style={active ? {
                backgroundColor: `${color}10`,
                border: `1px solid ${color}25`,
              } : { border: '1px solid transparent' }}
            >
              <div
                className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] transition-all duration-200"
                style={{
                  backgroundColor: complete ? color : active ? `${color}28` : 'var(--color-neutral-800)',
                  color: complete ? '#fff' : active ? color : 'var(--color-neutral-600)',
                }}
              >
                {complete ? (
                  <CheckCircle weight="bold" size={13} />
                ) : (
                  <Icon size={13} weight={active ? 'bold' : 'regular'} />
                )}
              </div>
              <div
                className="text-[11px] font-semibold leading-tight"
                style={{
                  color: active ? 'var(--color-neutral-50)' : complete ? color : 'var(--color-neutral-600)',
                }}
              >
                {phase.label}
              </div>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className="w-4 h-[1px] mx-[1px]"
                style={{ backgroundColor: complete ? color : 'var(--color-neutral-800)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
