import { segments } from '@/lib/config';
import { useStore } from '@/lib/store';
import { House } from '@phosphor-icons/react';

interface TopBarProps {
  activeSegment: string | null;
  onSegmentSelect: (id: string) => void;
  onHome: () => void;
}

export function TopBar({ activeSegment, onSegmentSelect, onHome }: TopBarProps) {
  const { state } = useStore();
  const run = state.runs[state.activeRunId];

  return (
    <div className="flex items-center justify-between px-6 py-2.5 border-b border-neutral-200 sticky top-0 bg-white/95 z-20 backdrop-blur-md">
      {/* Left: Logo + title */}
      <div className="flex items-center gap-2.5">
        <div
          onClick={onHome}
          className="w-[26px] h-[26px] rounded-[7px] bg-primary-500 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:brightness-110 transition-[filter] duration-150"
        >
          F
        </div>
        <span
          onClick={onHome}
          className="text-sm font-semibold cursor-pointer hover:text-neutral-600 transition-colors text-neutral-800"
        >
          Content Engine
        </span>
        <span className="text-[10px] text-neutral-400 font-mono">
          {run?.label ?? 'March 2026'}
        </span>
      </div>

      {/* Right: Navigation pills */}
      <nav className="flex items-center gap-1">
        <button
          onClick={onHome}
          className={`px-2.5 py-1.5 rounded-[7px] border-none cursor-pointer text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${
            !activeSegment
              ? 'bg-neutral-100 text-neutral-900'
              : 'bg-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <House size={13} weight={!activeSegment ? 'fill' : 'regular'} />
          Home
        </button>

        <div className="w-px h-4 bg-neutral-200 mx-1" />

        {segments.map(s => {
          const isActive = activeSegment === s.id;
          const segPhase = run?.segments[s.id]?.phase ?? 0;
          const isDone = segPhase >= 4;

          return (
            <button
              key={s.id}
              onClick={() => onSegmentSelect(s.id)}
              className={`relative px-3 py-1.5 rounded-[7px] border-none cursor-pointer text-xs font-semibold flex items-center gap-2 transition-all duration-150 ${
                isActive
                  ? 'text-neutral-900'
                  : 'bg-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
              }`}
              style={isActive ? { backgroundColor: `${s.color}12`, color: s.color } : undefined}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: isDone ? 'var(--color-success)' : isActive ? s.color : 'var(--color-neutral-300)',
                }}
              />
              {s.name}
              <span
                className="text-[9px] font-mono px-1 py-px rounded-[4px] leading-none"
                style={{
                  backgroundColor: isActive ? `${s.color}15` : 'var(--color-neutral-100)',
                  color: isDone ? 'var(--color-success)' : isActive ? s.color : 'var(--color-neutral-400)',
                }}
              >
                {isDone ? '4/4' : `${segPhase}/4`}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
