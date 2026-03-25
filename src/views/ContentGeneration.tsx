import { useState, useEffect, useRef, useMemo } from 'react';
import { useStoreState, useActions } from '@/lib/store';
import { getSegment } from '@/lib/config';
import { generatePackage, generateMockPackage } from '@/lib/claude-api';
import type { PubMedSource } from '@/lib/claude-api';
import { generateImage } from '@/lib/gemini-api';
import { scanPackage, hasHardFlags } from '@/lib/compliance-scanner';
import { ArrowsClockwise, ArrowRight, Check, SpinnerGap, Warning, Circle } from '@phosphor-icons/react';
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

type GenStatus = 'queued' | 'generating' | 'done';

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
  const [, setCurrentIndex] = useState(0);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const generatedRef = useRef(false);
  const topicsRef = useRef(topics);
  topicsRef.current = topics;

  // Fetch PubMed sources
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

  // Generate image
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

      const flags = scanPackage(newPkg);
      newPkg.complianceFlags = flags;
      if (hasHardFlags(flags)) newPkg.status = 'needs_edit';

      setPackages(prev => prev.map(p =>
        p.id === pkgId
          ? { ...newPkg, id: pkgId, regenerating: false, regenCount: (p.regenCount ?? 0) + 1 }
          : p
      ));

      generateImageForPackage(pkgId, newPkg, 'blog');
      generateImageForPackage(pkgId, newPkg, 'email');
    } catch {
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
        const sources = await fetchSources(topic);

        let pkg: ContentPackage;
        try {
          pkg = await generatePackage(topic, sources);
          pkg.generatedBy = 'claude';
        } catch {
          pkg = generateMockPackage(topic);
          pkg.generatedBy = 'mock';
        }

        const flags = scanPackage(pkg);
        pkg.complianceFlags = flags;
        if (hasHardFlags(flags)) pkg.status = 'needs_edit';

        if (cancelled) return;
        setPackages(prev => [...prev, pkg]);
        setCurrentIndex(i + 1);

        generateImageForPackage(pkg.id, pkg, 'blog');
        generateImageForPackage(pkg.id, pkg, 'email');
      }

      if (!cancelled) setGenerating(false);
    }

    generateAll();
    return () => { cancelled = true; generatedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.length]);

  // Save packages
  const packagesRef = useRef(packages);
  packagesRef.current = packages;
  useEffect(() => {
    if (!generating && packagesRef.current.length > 0) {
      actions.setPackages(segmentId, packagesRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  useEffect(() => {
    if (!generating && regeneratingId === null && packagesRef.current.length > 0) {
      actions.setPackages(segmentId, packagesRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regeneratingId]);

  const color = seg?.color ?? '#E8457A';
  const doneCount = packages.length;
  const totalImages = packages.length * 2;
  const imagesReady = packages.filter(p => p.blogImageUrl).length + packages.filter(p => p.emailImageUrl).length;
  const allDone = !generating && imagesReady >= totalImages;

  // Get status for each topic row
  function getTopicStatus(topicIndex: number): GenStatus {
    if (topicIndex < packages.length) return 'done';
    if (topicIndex === packages.length && generating) return 'generating';
    return 'queued';
  }

  function getComplianceDot(pkg: PackageWithProgress): { color: string; label: string } {
    const hard = pkg.complianceFlags.filter(f => f.severity === 'hard').length;
    const soft = pkg.complianceFlags.filter(f => f.severity !== 'hard').length;
    if (hard > 0) return { color: 'var(--color-error)', label: `${hard} hard flag${hard > 1 ? 's' : ''}` };
    if (soft > 0) return { color: 'var(--color-warning)', label: `${soft} soft flag${soft > 1 ? 's' : ''}` };
    return { color: 'var(--color-success)', label: 'Clean' };
  }

  return (
    <div className="max-w-[760px] mx-auto">
      {/* Progress header */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            {generating ? 'Generating content...' : 'Content ready'}
          </h2>
          <span className="text-sm font-mono text-neutral-400">
            {doneCount}/{topics.length} content · {imagesReady}/{totalImages} images
          </span>
        </div>
        <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${(doneCount / topics.length) * 100}%`,
              backgroundColor: allDone ? 'var(--color-success)' : color,
            }}
          />
        </div>
      </div>

      {/* Dashboard table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_70px_70px_60px] gap-2 px-4 py-2.5 border-b border-neutral-200 text-[10px] font-mono uppercase tracking-wide text-neutral-400">
          <span>Topic</span>
          <span className="text-center">Status</span>
          <span className="text-center">Compliance</span>
          <span className="text-center">Images</span>
          <span className="text-center">Action</span>
        </div>

        {/* Topic rows */}
        {topics.map((topic, i) => {
          const status = getTopicStatus(i);
          const pkg = packages[i] as PackageWithProgress | undefined;
          const compliance = pkg ? getComplianceDot(pkg) : null;
          const blogImg = pkg?.blogImageUrl;
          const emailImg = pkg?.emailImageUrl;
          const imgGenerating = pkg?.blogImageGenerating || pkg?.emailImageGenerating;

          return (
            <div
              key={topic.id}
              className="grid grid-cols-[1fr_80px_70px_70px_60px] gap-2 px-4 py-3 border-b border-neutral-100 items-center last:border-b-0"
              style={pkg?.regenerating ? { opacity: 0.5 } : undefined}
            >
              {/* Topic name */}
              <div className="min-w-0">
                <div className="text-[13px] text-neutral-800 truncate">
                  {pkg?.headline ?? topic.headline}
                </div>
                {pkg && (
                  <div className="text-[11px] text-neutral-400 font-mono">{pkg.wordCount}w · {pkg.subjectLine.length}ch subj</div>
                )}
              </div>

              {/* Status */}
              <div className="flex justify-center">
                {status === 'queued' && (
                  <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                    <Circle size={8} /> queued
                  </span>
                )}
                {status === 'generating' && (
                  <span className="text-[10px] font-mono flex items-center gap-1" style={{ color }}>
                    <SpinnerGap size={10} className="animate-spin" /> gen...
                  </span>
                )}
                {status === 'done' && (
                  <span className="text-[10px] font-mono text-success flex items-center gap-1">
                    <Check size={10} weight="bold" /> done
                  </span>
                )}
              </div>

              {/* Compliance dot */}
              <div className="flex justify-center">
                {compliance ? (
                  <span
                    className="text-[10px] font-mono flex items-center gap-1"
                    style={{ color: compliance.color }}
                    title={compliance.label}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: compliance.color }} />
                    {pkg!.complianceFlags.length > 0 ? pkg!.complianceFlags.length : ''}
                  </span>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </div>

              {/* Images */}
              <div className="flex justify-center">
                {pkg ? (
                  imgGenerating ? (
                    <SpinnerGap size={12} className="animate-spin text-neutral-400" />
                  ) : (
                    <span className="text-[10px] font-mono" style={{ color: blogImg && emailImg ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {(blogImg ? 1 : 0) + (emailImg ? 1 : 0)}/2
                    </span>
                  )
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </div>

              {/* Action */}
              <div className="flex justify-center">
                {pkg && !pkg.regenerating && (
                  <button
                    onClick={() => handleRegenerate(pkg.id)}
                    disabled={generating || regeneratingId !== null}
                    className="bg-transparent border-none cursor-pointer text-neutral-400 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Regenerate"
                  >
                    <ArrowsClockwise size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ready CTA */}
      {!generating && (
        <div className="mt-6 text-center">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-all animate-in"
            style={{ backgroundColor: color }}
          >
            Review {packages.length} Packages <ArrowRight size={16} weight="bold" />
          </button>
          <div className="text-[11px] text-neutral-400 mt-2">
            {packages.filter(p => p.complianceFlags.some(f => f.severity === 'hard')).length > 0 && (
              <span className="text-error flex items-center gap-1 justify-center">
                <Warning size={11} /> Some packages have compliance flags
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
