import { segments } from '@/lib/config';
import { useStore } from '@/lib/store';

interface TopBarProps {
  activeSegment: string | null;
  onSegmentSelect: (id: string) => void;
  onHome: () => void;
}

export function TopBar({ activeSegment, onSegmentSelect, onHome }: TopBarProps) {
  const { state } = useStore();
  const run = state.runs[state.activeRunId];

  return (
    <div className="flex items-center justify-between px-6 py-[11px] border-b border-neutral-800 sticky top-0 bg-neutral-950 z-10 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <div
          onClick={onHome}
          className="w-[26px] h-[26px] rounded-[7px] bg-primary-500 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:brightness-110 transition-[filter] duration-150"
        >
          F
        </div>
        <span
          onClick={onHome}
          className="text-sm font-semibold cursor-pointer hover:text-neutral-200 transition-colors"
        >
          Content Engine
        </span>
        <span className="text-[10px] text-neutral-600 font-mono">
          {run?.label ?? 'MAR 2026'}
        </span>
      </div>
      <div className="flex gap-[3px]">
        <button
          onClick={onHome}
          className={`px-2.5 py-[5px] rounded-[7px] border-none cursor-pointer text-xs font-medium transition-all duration-150 ${
            !activeSegment
              ? 'bg-primary-500/15 text-primary-500'
              : 'bg-transparent text-neutral-600 hover:text-neutral-400'
          }`}
        >
          Home
        </button>
        {segments.map(s => (
          <button
            key={s.id}
            onClick={() => onSegmentSelect(s.id)}
            className={`px-3 py-[5px] rounded-[7px] border-none cursor-pointer text-xs font-semibold flex items-center gap-[5px] transition-all duration-150 ${
              activeSegment === s.id
                ? 'text-white'
                : 'bg-transparent text-neutral-600 hover:text-neutral-400'
            }`}
            style={activeSegment === s.id ? { backgroundColor: `${s.color}1A`, color: s.color } : undefined}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: activeSegment === s.id ? s.color : 'var(--color-neutral-700)' }}
            />
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
