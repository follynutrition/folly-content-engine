import { useState, useEffect, useRef, useMemo } from 'react';
import { useStoreState, useActions } from '@/lib/store';
import { getSegment } from '@/lib/config';
import { generatePackage, generateMockPackage } from '@/lib/claude-api';
import { scanPackage, hasHardFlags } from '@/lib/compliance-scanner';
import type { ContentPackage } from '@/lib/types';

interface ContentGenerationProps {
  segmentId: string;
  onComplete: () => void;
}

export function ContentGeneration({ segmentId, onComplete }: ContentGenerationProps) {
  const state = useStoreState();
  const actions = useActions();
  const seg = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const allTopics = segState?.topics ?? [];
  // Stabilize topics reference — only recompute when topic count changes.
  // Topics are set once during import and don't change during content generation.
  const selectedCount = allTopics.filter(t => t.selected).length;
  const topics = useMemo(
    () => allTopics.filter(t => t.selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCount],
  );

  const [packages, setPackages] = useState<ContentPackage[]>([]);
  const [generating, setGenerating] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const generatedRef = useRef(false);
  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  useEffect(() => {
    if (generatedRef.current || topics.length === 0) return;
    generatedRef.current = true;

    let cancelled = false;
    const currentTopics = topicsRef.current;

    async function generateAll() {
      for (let i = 0; i < currentTopics.length; i++) {
        if (cancelled) return;
        const topic = currentTopics[i];

        let pkg: ContentPackage;
        try {
          // Try real Claude API first
          pkg = await generatePackage(topic);
        } catch {
          // Fall back to mock if API isn't available
          pkg = generateMockPackage(topic);
        }

        // Run compliance scan
        const flags = scanPackage(pkg);
        pkg.complianceFlags = flags;
        if (hasHardFlags(flags)) {
          pkg.status = 'needs_edit';
        }

        if (cancelled) return;
        setPackages(prev => [...prev, pkg]);
        setCurrentIndex(i + 1);
      }

      if (!cancelled) {
        setGenerating(false);
      }
    }

    generateAll();

    return () => {
      cancelled = true;
      generatedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.length]);

  // Save packages when generation is complete
  const packagesRef = useRef(packages);
  packagesRef.current = packages;
  useEffect(() => {
    if (!generating && packagesRef.current.length > 0) {
      actions.setPackages(segmentId, packagesRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  const color = seg?.color ?? '#E8457A';
  const flaggedCount = packages.filter(p => p.complianceFlags.length > 0).length;

  return (
    <div className="max-w-[720px] mx-auto">
      {generating && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[9px] mb-4 border"
          style={{ borderColor: `${color}22`, backgroundColor: `${color}0B` }}
        >
          <div className="w-[7px] h-[7px] rounded-full pulse-dot" style={{ backgroundColor: color }} />
          <span className="text-[13px]" style={{ color }}>
            Writing blog #{currentIndex + 1} + email teaser...
          </span>
          <span className="ml-auto text-xs text-neutral-600">
            {currentIndex}/{topics.length}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {packages.map(pkg => (
          <div key={pkg.id} className="animate-in bg-neutral-800 rounded-[10px] border border-neutral-700 p-3.5">
            {pkg.complianceFlags.length > 0 && (
              <div className="flex gap-1.5 mb-2.5 flex-wrap">
                {pkg.complianceFlags.map((flag, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-[3px] rounded-[6px] font-mono"
                    style={{
                      backgroundColor: flag.severity === 'hard' ? 'rgba(199,84,80,0.12)' : 'rgba(212,168,67,0.12)',
                      color: flag.severity === 'hard' ? 'var(--color-error)' : 'var(--color-warning)',
                    }}
                  >
                    {flag.severity === 'hard' ? '⚠ COMPLIANCE' : '⚠'} {flag.message}
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-between items-start mb-1">
              <h3 className="text-base font-serif text-neutral-50 leading-tight flex-1">
                {pkg.headline}
              </h3>
              <span className="text-[11px] text-neutral-600 font-mono shrink-0 ml-3">
                {pkg.wordCount}w
              </span>
            </div>

            <div className="text-[11px] text-neutral-600 mb-2">
              Answering: <em>"{pkg.sourceQuestion}"</em>
            </div>

            <p className="text-[13px] text-neutral-500 leading-relaxed mb-2.5">
              {pkg.blogBody.replace(/<[^>]*>/g, '').substring(0, 180)}...
            </p>

            <div
              className="p-2.5 rounded-lg"
              style={{
                backgroundColor: 'var(--color-neutral-900)',
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div className="flex justify-between items-center mb-[3px]">
                <span className="text-[10px] text-neutral-600 font-mono tracking-wide">
                  EMAIL TEASER
                </span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: pkg.subjectLine.length > 50 ? 'var(--color-error)' : 'var(--color-neutral-600)' }}
                >
                  {pkg.subjectLine.length}/50
                </span>
              </div>
              <div className="text-[13px] font-semibold text-neutral-50">
                {pkg.subjectLine}
              </div>
              <div className="text-xs text-neutral-500">
                {pkg.previewText}
              </div>
            </div>
          </div>
        ))}

        {generating && (
          <div className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-3.5">
            <div className="skeleton h-[18px] w-[70%]" />
            <div className="skeleton h-3 w-[90%] mt-2.5" />
            <div className="skeleton h-3 w-[45%] mt-1.5" />
          </div>
        )}
      </div>

      {!generating && (
        <div className="flex justify-between items-center mt-5">
          <span className="text-neutral-500">
            {packages.length} packages · {flaggedCount} flagged
          </span>
          <button
            onClick={onComplete}
            className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-[filter]"
            style={{ backgroundColor: color }}
          >
            Generate Images →
          </button>
        </div>
      )}
    </div>
  );
}
