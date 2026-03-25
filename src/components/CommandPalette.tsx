import { useState, useEffect, useRef, useMemo } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { segments } from '@/lib/config';
import { useStoreState } from '@/lib/store';
import { PHASES } from '@/lib/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (segmentId: string | null) => void;
}

interface Command {
  id: string;
  label: string;
  sublabel?: string;
  action: () => void;
  category: string;
}

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useStoreState();
  const run = state.runs[state.activeRunId];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands = useMemo((): Command[] => {
    const cmds: Command[] = [];

    cmds.push({
      id: 'home',
      label: 'Go to Run Home',
      sublabel: run?.label,
      action: () => { onNavigate(null); onClose(); },
      category: 'Navigation',
    });

    for (const seg of segments) {
      const segState = run?.segments[seg.id];
      const phase = segState?.phase ?? 0;
      const phaseLabel = phase >= PHASES.length ? 'Complete' : PHASES[phase]?.label;
      cmds.push({
        id: `seg-${seg.id}`,
        label: seg.display_name,
        sublabel: `Phase: ${phaseLabel}`,
        action: () => { onNavigate(seg.id); onClose(); },
        category: 'Segments',
      });

      const packages = segState?.packages ?? [];
      for (const pkg of packages) {
        cmds.push({
          id: `pkg-${pkg.id}`,
          label: pkg.headline,
          sublabel: `${seg.name} · ${pkg.status}`,
          action: () => { onNavigate(seg.id); onClose(); },
          category: 'Packages',
        });
      }
    }

    return cmds;
  }, [run, onNavigate, onClose]);

  const filtered = useMemo(() => {
    if (!query) return commands.slice(0, 10);
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.sublabel?.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, commands]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && filtered[selectedIndex]) { filtered[selectedIndex].action(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-50"
        onClick={onClose}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[520px] max-w-[90vw] bg-white border border-neutral-200 rounded-xl shadow-2xl z-50 overflow-hidden"
        style={{ animation: 'fadeSlideIn 0.15s ease-out' }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200">
          <MagnifyingGlass size={18} className="text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search segments, packages, actions..."
            className="flex-1 bg-transparent border-none text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <span className="text-[10px] text-neutral-400 font-mono px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200">ESC</span>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-neutral-400">No results found</div>
          )}
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              onClick={cmd.action}
              className="flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors"
              style={{ backgroundColor: i === selectedIndex ? 'var(--color-neutral-100)' : 'transparent' }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div>
                <div className="text-sm text-neutral-900">{cmd.label}</div>
                {cmd.sublabel && <div className="text-[11px] text-neutral-400">{cmd.sublabel}</div>}
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">{cmd.category}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
