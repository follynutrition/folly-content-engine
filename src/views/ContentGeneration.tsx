import { useState, useEffect, useRef, useMemo } from 'react';
import { useStoreState, useActions } from '@/lib/store';
import { getSegment } from '@/lib/config';
import { generatePackage, generateMockPackage } from '@/lib/claude-api';
import type { PubMedSource } from '@/lib/claude-api';
import { generateImage } from '@/lib/gemini-api';
import { scanPackage, hasHardFlags } from '@/lib/compliance-scanner';
import { ArrowsClockwise, CaretDown, CaretUp, Check, SpinnerGap, Image as ImageIcon, X } from '@phosphor-icons/react';
import type { ContentPackage } from '@/lib/types';

interface ContentGenerationProps {
  segmentId: string;
  onComplete: () => void;
}

interface PackageWithProgress extends ContentPackage {
  blogImageGenerating?: boolean;
  emailImageGenerating?: boolean;
  regenerating?: boolean;
  regenCount?: number;
}

export function ContentGeneration({ segmentId, onComplete }: ContentGenerationProps) {
  const state = useStoreState();
  const actions = useActions();
  const seg = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const allTopics = segState?.topics ?? [];
  const selectedCount = allTopics.filter(t => t.selected).length;
  const topics = useMemo(
    () => allTopics.filter(t => t.selected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCount],
  );

  const [packages, setPackages] = useState<PackageWithProgress[]>([]);
  const [generating, setGenerating] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const generatedRef = useRef(false);
  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  // Fetch PubMed sources for a topic
  async function fetchSources(topic: { headline: string; segment: string }): Promise<PubMedSource[]> {
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${topic.headline} hair loss`, maxResults: 3 }),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.results ?? [];
    } catch {
      return [];
    }
  }

  // Generate image for a package and update state
  async function generateImageForPackage(pkgId: string, pkg: ContentPackage, type: 'blog' | 'email') {
    const field = type === 'blog' ? 'blogImageUrl' : 'emailImageUrl';
    const statusField = type === 'blog' ? 'blogImageStatus' : 'emailImageStatus';
    const genField = type === 'blog' ? 'blogImageGenerating' : 'emailImageGenerating';

    setPackages(prev => prev.map(p =>
      p.id === pkgId ? { ...p, [genField]: true, [statusField]: 'generating' } : p
    ));

    try {
      const url = await generateImage(pkg, type);
      setPackages(prev => prev.map(p =>
        p.id === pkgId ? { ...p, [field]: url, [statusField]: 'ready', [genField]: false } : p
      ));
    } catch {
      // Image generation failed — leave as pending, user can retry via Regen button
      setPackages(prev => prev.map(p =>
        p.id === pkgId ? { ...p, [statusField]: 'pending', [genField]: false } : p
      ));
    }
  }

  // Regenerate a single package
  async function handleRegenerate(pkgId: string) {
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;
    const topic = topics.find(t => t.id === pkg.topicId);
    if (!topic) return;

    setRegeneratingId(pkgId);
    setPackages(prev => prev.map(p =>
      p.id === pkgId ? { ...p, regenerating: true } : p
    ));

    try {
      const sources = await fetchSources(topic);
      let newPkg: ContentPackage;
      try {
        newPkg = await generatePackage(topic, sources);
        newPkg.generatedBy = 'claude';
      } catch {
        newPkg = generateMockPackage(topic);
        newPkg.generatedBy = 'mock';
      }

      // Run compliance scan
      const flags = scanPackage(newPkg);
      newPkg.complianceFlags = flags;
      if (hasHardFlags(flags)) {
        newPkg.status = 'needs_edit';
      }

      // Replace the package, keeping the same id and incrementing regenCount
      setPackages(prev => prev.map(p =>
        p.id === pkgId
          ? {
              ...newPkg,
              id: pkgId,
              regenerating: false,
              regenCount: (p.regenCount ?? 0) + 1,
            }
          : p
      ));

      // Start image generation for the new package
      generateImageForPackage(pkgId, newPkg, 'blog');
      generateImageForPackage(pkgId, newPkg, 'email');
    } catch {
      // On failure, clear the regenerating state
      setPackages(prev => prev.map(p =>
        p.id === pkgId ? { ...p, regenerating: false } : p
      ));
    } finally {
      setRegeneratingId(null);
    }
  }

  useEffect(() => {
    if (generatedRef.current || topics.length === 0) return;
    generatedRef.current = true;

    let cancelled = false;
    const currentTopics = topicsRef.current;

    async function generateAll() {
      for (let i = 0; i < currentTopics.length; i++) {
        if (cancelled) return;
        const topic = currentTopics[i];

        // Step 1: Fetch PubMed sources (fast, non-blocking)
        const sources = await fetchSources(topic);

        // Step 2: Generate content (blog + email)
        let pkg: ContentPackage;
        try {
          pkg = await generatePackage(topic, sources);
          pkg.generatedBy = 'claude';
        } catch {
          pkg = generateMockPackage(topic);
          pkg.generatedBy = 'mock';
        }

        // Step 3: Run compliance scan
        const flags = scanPackage(pkg);
        pkg.complianceFlags = flags;
        if (hasHardFlags(flags)) {
          pkg.status = 'needs_edit';
        }

        if (cancelled) return;
        setPackages(prev => [...prev, pkg]);
        setCurrentIndex(i + 1);

        // Step 4: Start image generation IN PARALLEL (don't await)
        generateImageForPackage(pkg.id, pkg, 'blog');
        generateImageForPackage(pkg.id, pkg, 'email');
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

  // Save packages after a regeneration completes
  useEffect(() => {
    if (!generating && regeneratingId === null && packagesRef.current.length > 0) {
      actions.setPackages(segmentId, packagesRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regeneratingId]);

  const color = seg?.color ?? '#E8457A';
  const flaggedCount = packages.filter(p => p.complianceFlags.length > 0).length;
  const imagesReady = packages.filter(p => p.blogImageUrl && p.emailImageUrl).length;

  return (
    <div className="max-w-[760px] mx-auto">
      {generating && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[9px] mb-4 border"
          style={{ borderColor: `${color}22`, backgroundColor: `${color}0B` }}
        >
          <div className="w-[7px] h-[7px] rounded-full pulse-dot" style={{ backgroundColor: color }} />
          <span className="text-[13px]" style={{ color }}>
            Generating package {currentIndex + 1} of {topics.length}...
          </span>
          <span className="ml-auto text-xs text-neutral-600">
            {currentIndex}/{topics.length} content · {imagesReady}/{packages.length * 2} images
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {packages.map(pkg => {
          const isExpanded = expandedPkg === pkg.id;
          return (
            <div key={pkg.id} className="animate-in bg-neutral-800 rounded-[10px] border border-neutral-700 relative">
              {/* Regen button — top right corner */}
              {!pkg.regenerating && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRegenerate(pkg.id); }}
                  disabled={generating || regeneratingId !== null}
                  className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 bg-transparent border-none cursor-pointer text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  style={{ fontSize: '12px' }}
                  title="Regenerate this package"
                >
                  <ArrowsClockwise size={12} />
                  Regen
                  {(pkg.regenCount ?? 0) > 0 && (
                    <span className="text-[10px] font-mono text-neutral-600 ml-0.5">&times;{pkg.regenCount}</span>
                  )}
                </button>
              )}

              {/* Shimmer overlay when regenerating */}
              {pkg.regenerating && (
                <div className="absolute inset-0 z-10 rounded-[10px] overflow-hidden">
                  <div className="w-full h-full skeleton" />
                </div>
              )}

              {/* Compliance flags */}
              {pkg.complianceFlags.length > 0 && (
                <div className="flex gap-1.5 px-3.5 pt-3 flex-wrap">
                  {pkg.complianceFlags.slice(0, 3).map((flag, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2.5 py-[3px] rounded-[6px] font-mono"
                      style={{
                        backgroundColor: flag.severity === 'hard' ? 'rgba(199,84,80,0.12)' : 'rgba(212,168,67,0.12)',
                        color: flag.severity === 'hard' ? 'var(--color-error)' : 'var(--color-warning)',
                      }}
                    >
                      {flag.severity === 'hard' ? '⚠ COMPLIANCE' : '⚠'} {flag.message}
                      {flag.suggestion && (
                        <span
                          className="ml-1 cursor-pointer hover:brightness-125 transition-[filter]"
                          style={{ color: flag.severity === 'hard' ? '#f0a0a0' : '#e8d088' }}
                          title="Click to copy suggestion"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(flag.suggestion!); }}
                        >
                          → {flag.suggestion}
                        </span>
                      )}
                    </span>
                  ))}
                  {pkg.complianceFlags.length > 3 && (
                    <span className="text-[11px] text-neutral-500">+{pkg.complianceFlags.length - 3} more</span>
                  )}
                </div>
              )}

              {/* Header — always visible */}
              <div className="p-3.5">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-base font-serif text-neutral-50 leading-tight flex-1">{pkg.headline}</h3>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {/* Image status indicators */}
                    {(pkg.blogImageGenerating || pkg.emailImageGenerating) && (
                      <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                        <SpinnerGap size={10} className="animate-spin" /> images
                      </span>
                    )}
                    {pkg.blogImageUrl && pkg.emailImageUrl && (
                      <span className="text-[10px] font-mono text-success flex items-center gap-1">
                        <ImageIcon size={10} /> <Check size={8} />
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-600 font-mono">{pkg.wordCount}w</span>
                    {pkg.generatedBy && (
                      <span
                        className="text-[9px] font-mono flex items-center gap-1"
                        style={{ color: pkg.generatedBy === 'claude' ? 'var(--color-success)' : '#d4a843' }}
                      >
                        <span
                          className="w-[5px] h-[5px] rounded-full inline-block"
                          style={{ backgroundColor: pkg.generatedBy === 'claude' ? 'var(--color-success)' : '#d4a843' }}
                        />
                        {pkg.generatedBy === 'claude' ? 'CLAUDE' : 'MOCK'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-neutral-600 mb-2">
                  Answering: <em>"{pkg.sourceQuestion}"</em>
                </div>

                {/* Preview — first paragraph */}
                <p className="text-[13px] text-neutral-500 leading-relaxed mb-2">
                  {pkg.blogBody.replace(/<[^>]*>/g, '').substring(0, 180)}...
                </p>

                {/* Email teaser panel */}
                <div
                  className="p-2.5 rounded-lg"
                  style={{ backgroundColor: 'var(--color-neutral-900)', borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex justify-between items-center mb-[3px]">
                    <span className="text-[10px] text-neutral-600 font-mono tracking-wide">EMAIL TEASER</span>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: pkg.subjectLine.length > 50 ? 'var(--color-error)' : 'var(--color-neutral-600)' }}
                    >
                      {pkg.subjectLine.length}/50
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-neutral-50">{pkg.subjectLine}</div>
                  <div className="text-xs text-neutral-500">{pkg.previewText}</div>
                </div>

                {/* Expand/collapse button */}
                <button
                  onClick={() => setExpandedPkg(isExpanded ? null : pkg.id)}
                  className="mt-2 text-xs text-neutral-500 hover:text-neutral-300 bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
                >
                  {isExpanded ? <><CaretUp size={12} /> Collapse</> : <><CaretDown size={12} /> Read full blog</>}
                </button>
              </div>

              {/* Expanded: full blog + images */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5 border-t border-neutral-700 pt-3">
                  {/* Full blog content */}
                  <div className="bg-white rounded-lg p-5 text-neutral-950 mb-3">
                    <h2 className="text-lg font-serif leading-tight mb-2">{pkg.headline}</h2>
                    <div className="text-[11px] text-neutral-400 mb-3">By Luna Yu · {pkg.wordCount} words</div>
                    <div
                      className="text-[13px] leading-relaxed text-neutral-700 [&>p]:mb-3"
                      dangerouslySetInnerHTML={{ __html: pkg.blogBody }}
                    />
                  </div>

                  {/* Images row with QA controls */}
                  <div className="flex gap-2">
                    {[
                      { url: pkg.blogImageUrl, label: 'BLOG', type: 'blog' as const, generating: pkg.blogImageGenerating, status: pkg.blogImageStatus },
                      { url: pkg.emailImageUrl, label: 'EMAIL', type: 'email' as const, generating: pkg.emailImageGenerating, status: pkg.emailImageStatus },
                    ].map(img => (
                      <div key={img.label} className="flex-1 h-[100px] rounded-lg overflow-hidden relative flex items-center justify-center bg-neutral-900" style={{ border: img.status === 'accepted' ? '2px solid var(--color-success)' : '1px solid var(--color-neutral-700)' }}>
                        {img.generating ? (
                          <div className="skeleton w-[60%] h-[40%]" />
                        ) : img.url ? (
                          <>
                            <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                            {img.status === 'accepted' && (
                              <div className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-success flex items-center justify-center">
                                <Check weight="bold" size={10} className="text-white" />
                              </div>
                            )}
                            {img.status !== 'accepted' && (
                              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1.5" style={{ background: 'rgba(20,18,16,0.85)', backdropFilter: 'blur(4px)' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, [`${img.type}ImageStatus`]: 'accepted' } : p)); }}
                                  className="px-2 py-[3px] rounded-[5px] border-none bg-success text-white text-[10px] cursor-pointer font-semibold flex items-center gap-1"
                                >
                                  <Check weight="bold" size={9} /> Accept
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); generateImageForPackage(pkg.id, pkg, img.type); }}
                                  className="px-2 py-[3px] rounded-[5px] border-none bg-error text-white text-[10px] cursor-pointer font-semibold flex items-center gap-1"
                                >
                                  <X weight="bold" size={9} /> Regen
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-[9px] font-mono text-neutral-600">{img.label} IMAGE</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
            {packages.length} packages · {flaggedCount} flagged · {imagesReady * 2}/{packages.length * 2} images ready
          </span>
          <button
            onClick={onComplete}
            className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-[filter]"
            style={{ backgroundColor: color }}
          >
            Review Packages →
          </button>
        </div>
      )}
    </div>
  );
}
