import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MagnifyingGlass, ArrowUpRight, TrendUp } from '@phosphor-icons/react';
import { getSegment } from '@/lib/config';
import { getMockResearchResults } from '@/lib/search-mock';
import { emotionColor, cn } from '@/lib/utils';
import type { ResearchResult } from '@/lib/types';

interface ResearchProps {
  segmentId: string;
  onComplete: () => void;
}

type ViewState = 'idle' | 'running' | 'done';

export function Research({ segmentId, onComplete }: ResearchProps) {
  const segment = getSegment(segmentId);
  const allResults = useMemo(() => getMockResearchResults(segmentId), [segmentId]);

  const [viewState, setViewState] = useState<ViewState>('idle');
  const [visibleResults, setVisibleResults] = useState<ResearchResult[]>([]);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Unique sources for cycling the status bar
  const sources = useMemo(() =>
    segment ? [...segment.reddit_sources, 'Google PAA'] : ['Google PAA'],
    [segment]
  );

  const startResearch = useCallback(() => {
    setViewState('running');
    setVisibleResults([]);
    setCurrentSourceIndex(0);
  }, []);

  // Stream results in one at a time
  useEffect(() => {
    if (viewState !== 'running') return;

    const idx = visibleResults.length;
    if (idx >= allResults.length) {
      setViewState('done');
      return;
    }

    const timer = setTimeout(() => {
      setVisibleResults(prev => [...prev, allResults[idx]]);
      // Cycle through sources for the status text
      setCurrentSourceIndex(idx % sources.length);
    }, 350);

    return () => clearTimeout(timer);
  }, [viewState, visibleResults.length, allResults, sources.length]);

  // Auto-scroll as results appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleResults.length]);

  if (!segment) return null;

  const segColor = segment.color;

  // ── Idle state ──────────────────────────────────────────────
  if (viewState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="max-w-[500px] w-full text-center">
          <MagnifyingGlass
            size={44}
            weight="light"
            className="mx-auto mb-5"
            style={{ color: segColor, opacity: 0.85 }}
          />
          <h2 className="text-[22px] font-semibold mb-2 text-neutral-50">
            Pull real questions from the internet
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed mb-8">
            Search <span className="text-neutral-200 font-medium">{segment.display_name}</span> communities
            for real questions people are asking right now.
            <br />
            <span className="text-neutral-500">
              Sources: {segment.reddit_sources.join(', ')}, Google PAA
            </span>
          </p>

          <button
            onClick={startResearch}
            className="text-white text-sm font-semibold px-7 py-[10px] rounded-[10px] border-none cursor-pointer transition-[filter] duration-150 hover:brightness-110 mb-8"
            style={{ backgroundColor: segColor }}
          >
            Start Research
          </button>

          <div className="border border-neutral-700 rounded-[10px] bg-neutral-800/50 p-5">
            <p className="text-xs text-neutral-500 font-mono tracking-wider mb-3 uppercase">
              Or import from NotebookLM
            </p>
            <button
              onClick={onComplete}
              className="text-neutral-300 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-150 hover:text-neutral-100"
            >
              Skip to Topic Import <span className="ml-1">&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Running + Done states ───────────────────────────────────
  const displayResults = viewState === 'done' ? allResults : visibleResults;

  return (
    <div className="max-w-[640px] mx-auto py-8 px-4 flex flex-col h-full">
      {/* Status bar */}
      {viewState === 'running' && (
        <div className="flex items-center gap-3 mb-5 px-3 py-2.5 rounded-[10px] bg-neutral-800 border border-neutral-700">
          <span
            className="pulse-dot inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: segColor }}
          />
          <span className="text-sm text-neutral-300">
            Searching{' '}
            <span className="text-neutral-100 font-medium">
              {sources[currentSourceIndex]}
            </span>
            ...
          </span>
          <span className="ml-auto text-xs font-mono text-neutral-500">
            {visibleResults.length}/{allResults.length}
          </span>
        </div>
      )}

      {/* Results list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-2">
        {displayResults.map((r, i) => (
          <ResultCard key={`${r.source}-${i}`} result={r} segColor={segColor} />
        ))}
      </div>

      {/* Done footer */}
      {viewState === 'done' && (
        <div className="mt-6 pt-5 border-t border-neutral-700 flex items-center justify-between animate-in">
          <p className="text-sm text-neutral-400">
            <span className="text-neutral-100 font-semibold">{allResults.length} questions</span>{' '}
            found &mdash; ready to generate topics
          </p>
          <button
            onClick={onComplete}
            className="text-white text-sm font-semibold px-6 py-[9px] rounded-[10px] border-none cursor-pointer transition-[filter] duration-150 hover:brightness-110"
            style={{ backgroundColor: segColor }}
          >
            Generate Topics &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

// ── Result Card ───────────────────────────────────────────────

function ResultCard({ result, segColor }: { result: ResearchResult; segColor: string }) {
  const isReddit = result.source.startsWith('r/');
  const emColor = emotionColor(result.emotion);

  return (
    <div className="animate-in bg-neutral-800 border border-neutral-700 rounded-[10px] p-4">
      <p className="text-[13.5px] text-neutral-50 leading-relaxed mb-3">
        &ldquo;{result.question}&rdquo;
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Source tag */}
        <span
          className={cn(
            'font-mono text-[10px] px-2 py-[2px] rounded-full',
            isReddit ? 'bg-neutral-700 text-neutral-300' : 'bg-info/12 text-info',
          )}
        >
          {result.source}
        </span>

        {/* Upvote count */}
        {isReddit && result.votes != null && (
          <span className="font-mono text-[10px] px-2 py-[2px] rounded-full bg-neutral-700 text-neutral-400 flex items-center gap-1">
            <ArrowUpRight size={10} weight="bold" />
            {result.votes.toLocaleString()}
          </span>
        )}

        {/* Emotion tag */}
        <span
          className="font-mono text-[10px] px-2 py-[2px] rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${emColor} 14%, transparent)`,
            color: emColor,
          }}
        >
          {result.emotion}
        </span>

        {/* Trending tag */}
        {result.trending && (
          <span
            className="font-mono text-[10px] px-2 py-[2px] rounded-full flex items-center gap-1"
            style={{
              backgroundColor: `color-mix(in srgb, ${segColor} 14%, transparent)`,
              color: segColor,
            }}
          >
            <TrendUp size={10} weight="bold" />
            trending
          </span>
        )}
      </div>
    </div>
  );
}
