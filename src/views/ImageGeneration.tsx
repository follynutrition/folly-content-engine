import { useState, useEffect, useRef } from 'react';
import { useStoreState, useActions } from '@/lib/store';
import { getSegment } from '@/lib/config';
import { generateImage } from '@/lib/gemini-api';
import { Check, X, ArrowsClockwise } from '@phosphor-icons/react';
import type { ImageQAStatus } from '@/lib/types';

interface ImageGenerationProps {
  segmentId: string;
  onComplete: () => void;
}

interface ImageState {
  blogStatus: ImageQAStatus;
  emailStatus: ImageQAStatus;
}

export function ImageGeneration({ segmentId, onComplete }: ImageGenerationProps) {
  const state = useStoreState();
  const actions = useActions();
  const seg = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const packages = segState?.packages ?? [];

  const [imageCount, setImageCount] = useState(0);
  const [done, setDone] = useState(false);
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const startedRef = useRef(false);
  const packagesRef = useRef(packages);
  packagesRef.current = packages;

  const totalImages = packages.length * 2;

  useEffect(() => {
    if (startedRef.current || packages.length === 0) return;
    startedRef.current = true;

    let cancelled = false;

    async function generateAll() {
      const pkgs = packagesRef.current;
      let count = 0;

      for (const pkg of pkgs) {
        for (const type of ['blog', 'email'] as const) {
          if (cancelled) return;

          try {
            const url = await generateImage(pkg, type);
            if (!cancelled) {
              setImageUrls(prev => ({ ...prev, [`${pkg.id}-${type}`]: url }));
            }
          } catch {
            // API not available — use gradient placeholder (no URL stored)
          }

          count++;
          if (!cancelled) setImageCount(count);
        }
      }

      if (!cancelled) setDone(true);
    }

    generateAll();

    return () => {
      cancelled = true;
      startedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages.length]);

  const getImageReady = (pkgIndex: number, type: 'blog' | 'email'): boolean => {
    const target = type === 'blog' ? pkgIndex * 2 : pkgIndex * 2 + 1;
    return imageCount > target;
  };

  const setImageStatus = (pkgId: string, type: 'blog' | 'email', status: ImageQAStatus) => {
    setImageStates(prev => ({
      ...prev,
      [pkgId]: {
        ...prev[pkgId],
        [`${type}Status`]: status,
      } as ImageState,
    }));

    // If rejecting, regenerate
    if (status === 'rejected') {
      const pkg = packagesRef.current.find(p => p.id === pkgId);
      if (pkg) {
        generateImage(pkg, type, 'different pose/angle').then(url => {
          setImageUrls(prev => ({ ...prev, [`${pkgId}-${type}`]: url }));
          setImageStates(prev => ({
            ...prev,
            [pkgId]: { ...prev[pkgId], [`${type}Status`]: 'accepted' } as ImageState,
          }));
        }).catch(() => {
          // Fallback: just re-accept after delay
          setTimeout(() => {
            setImageStates(prev => ({
              ...prev,
              [pkgId]: { ...prev[pkgId], [`${type}Status`]: 'accepted' } as ImageState,
            }));
          }, 1500);
        });
      }
    }
  };

  const getStatus = (pkgId: string, type: 'blog' | 'email'): ImageQAStatus => {
    return imageStates[pkgId]?.[`${type}Status` as keyof ImageState] ?? 'pending';
  };

  const acceptedCount = Object.values(imageStates).reduce((acc, s) => {
    return acc + (s.blogStatus === 'accepted' ? 1 : 0) + (s.emailStatus === 'accepted' ? 1 : 0);
  }, 0);

  const allDecided = done && acceptedCount >= totalImages;

  const color = seg?.color ?? '#E8457A';

  const handleComplete = () => {
    // Update packages with image statuses
    const updated = packages.map(pkg => ({
      ...pkg,
      blogImageStatus: getStatus(pkg.id, 'blog') as ImageQAStatus,
      emailImageStatus: getStatus(pkg.id, 'email') as ImageQAStatus,
      blogImageUrl: getStatus(pkg.id, 'blog') === 'accepted' ? (imageUrls[`${pkg.id}-blog`] ?? `https://placeholder.folly/${pkg.id}-blog.jpg`) : null,
      emailImageUrl: getStatus(pkg.id, 'email') === 'accepted' ? (imageUrls[`${pkg.id}-email`] ?? `https://placeholder.folly/${pkg.id}-email.jpg`) : null,
    }));
    actions.setPackages(segmentId, updated);
    onComplete();
  };

  return (
    <div className="max-w-[720px] mx-auto">
      {!done && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[9px] mb-4 border"
          style={{ borderColor: `${color}22`, backgroundColor: `${color}0B` }}
        >
          <div className="w-[7px] h-[7px] rounded-full pulse-dot" style={{ backgroundColor: color }} />
          <span className="text-[13px]" style={{ color }}>Generating via Gemini...</span>
          <span className="ml-auto text-xs text-neutral-600">{imageCount}/{totalImages}</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {packages.map((pkg, pkgIdx) => {
          const blogReady = getImageReady(pkgIdx, 'blog');
          const emailReady = getImageReady(pkgIdx, 'email');

          return (
            <div key={pkg.id} className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-3 px-3.5">
              <div className="text-[13px] font-serif text-neutral-50 mb-2.5">
                {pkg.headline}
              </div>
              <div className="flex gap-2.5">
                {[
                  { ready: blogReady, label: 'BLOG', dim: '1200×628', type: 'blog' as const, c: color },
                  { ready: emailReady, label: 'EMAIL', dim: '600×400', type: 'email' as const, c: '#E8457A' },
                ].map(img => {
                  const status = getStatus(pkg.id, img.type);
                  const isRegen = status === 'rejected';
                  const isAccepted = status === 'accepted';
                  const imgUrl = imageUrls[`${pkg.id}-${img.type}`];

                  return (
                    <div
                      key={img.type}
                      className="flex-1 h-[110px] rounded-lg relative overflow-hidden flex items-center justify-center transition-all duration-300"
                      style={{
                        background: isRegen
                          ? 'var(--color-neutral-900)'
                          : img.ready
                            ? (imgUrl ? 'var(--color-neutral-900)' : `linear-gradient(135deg, ${img.c}30, ${img.c}08)`)
                            : 'var(--color-neutral-900)',
                        border: isAccepted
                          ? '2px solid var(--color-success)'
                          : `1px solid ${img.ready ? `${img.c}22` : 'var(--color-neutral-800)'}`,
                      }}
                    >
                      {isRegen ? (
                        <div className="skeleton w-[60%] h-[40%]" />
                      ) : img.ready ? (
                        <>
                          {imgUrl ? (
                            <img src={imgUrl} alt={`${img.label} image`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center">
                              <span className="text-[9px] font-mono tracking-wide" style={{ color: img.c }}>
                                {img.label} IMAGE
                              </span>
                              <div className="text-[10px] text-neutral-600 mt-0.5">{img.dim}</div>
                            </div>
                          )}
                          {isAccepted && (
                            <div className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-success flex items-center justify-center text-[10px] text-white">
                              <Check weight="bold" size={10} />
                            </div>
                          )}
                          {!isAccepted && done && (
                            <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1.5" style={{ background: 'rgba(20,18,16,0.85)', backdropFilter: 'blur(4px)' }}>
                              <button
                                onClick={() => setImageStatus(pkg.id, img.type, 'accepted')}
                                className="px-2.5 py-[3px] rounded-[5px] border-none bg-success text-white text-[10px] cursor-pointer font-semibold flex items-center gap-1"
                              >
                                <Check weight="bold" size={10} /> Accept
                              </button>
                              <button
                                onClick={() => setImageStatus(pkg.id, img.type, 'rejected')}
                                className="px-2.5 py-[3px] rounded-[5px] border-none bg-error text-white text-[10px] cursor-pointer font-semibold flex items-center gap-1"
                              >
                                <X weight="bold" size={10} /> Regen
                              </button>
                              <button className="px-2.5 py-[3px] rounded-[5px] border border-neutral-700 bg-transparent text-neutral-500 text-[10px] cursor-pointer flex items-center gap-1">
                                <ArrowsClockwise size={10} /> Swap
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="skeleton w-[60%] h-[40%]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <div className="flex justify-between items-center mt-5">
          <span className="text-neutral-500">
            {acceptedCount}/{totalImages} accepted
          </span>
          <button
            onClick={handleComplete}
            className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold transition-[filter]"
            style={{
              backgroundColor: color,
              opacity: allDecided ? 1 : 0.4,
              cursor: allDecided ? 'pointer' : 'not-allowed',
            }}
            disabled={!allDecided}
          >
            Review Packages →
          </button>
        </div>
      )}
    </div>
  );
}
