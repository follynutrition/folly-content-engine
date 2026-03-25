import { useState, useEffect, useRef } from 'react';
import { BookOpen, ArrowSquareOut, ArrowsClockwise, SpinnerGap, CaretDown, CaretUp } from '@phosphor-icons/react';
import { getSegment } from '@/lib/config';
import { api } from '@/lib/api-client';
import type { StudyRow } from '@/lib/api-client';

interface Props {
  segmentId: string;
  onComplete: () => void;
}

export function StudyLibrary({ segmentId, onComplete }: Props) {
  const segment = getSegment(segmentId);
  const color = segment?.color ?? '#E8457A';

  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch studies on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    api.studies
      .list(segmentId, 100)
      .then(res => {
        // Sort by citation_count DESC
        const sorted = [...res.studies].sort((a, b) => b.citation_count - a.citation_count);
        setStudies(sorted);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load studies');
      })
      .finally(() => setLoading(false));
  }, [segmentId]);

  // Refresh studies from Semantic Scholar
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await api.studies.refresh(segmentId);
      // Re-fetch the list
      const res = await api.studies.list(segmentId, 100);
      const sorted = [...res.studies].sort((a, b) => b.citation_count - a.citation_count);
      setStudies(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh studies');
    } finally {
      setRefreshing(false);
    }
  };

  const parseAuthors = (authors: string): string[] => {
    try {
      const parsed = JSON.parse(authors);
      if (Array.isArray(parsed)) return parsed.map((a: { name?: string }) => a.name ?? String(a));
    } catch {
      // Not JSON, treat as comma-separated
    }
    return authors.split(',').map(a => a.trim()).filter(Boolean);
  };

  return (
    <div className="max-w-[800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
          <BookOpen size={20} style={{ color }} weight="duotone" />
          Study Library — <span style={{ color }}>{segment?.display_name}</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 text-xs cursor-pointer hover:border-neutral-300 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? (
              <SpinnerGap size={12} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={12} />
            )}
            {refreshing ? 'Refreshing...' : 'Refresh Studies'}
          </button>
        </div>
      </div>
      <p className="text-sm text-neutral-500 mb-5">
        Peer-reviewed research from Semantic Scholar, sorted by citation count. Click any study to expand.
      </p>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-[10px] border border-neutral-200 p-4 shadow-sm">
              <div className="skeleton h-4 w-[75%] mb-2" />
              <div className="skeleton h-3 w-[50%] mb-1.5" />
              <div className="skeleton h-3 w-[90%]" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-white rounded-[10px] border border-error/20 text-sm text-error shadow-sm">
          {error}
        </div>
      )}

      {/* Study count */}
      {!loading && studies.length > 0 && (
        <div className="text-[10px] font-mono text-neutral-400 tracking-wide uppercase mb-2">
          {studies.length} studies
        </div>
      )}

      {/* Studies list */}
      {!loading && studies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {studies.map(study => {
            const isExpanded = expandedId === study.paper_id;
            const authorsList = parseAuthors(study.authors);

            return (
              <div
                key={study.paper_id}
                className="bg-white rounded-[10px] border border-neutral-200 shadow-sm transition-all"
              >
                {/* Collapsed header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : study.paper_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-[13.5px] font-semibold text-neutral-900 leading-snug flex-1">
                      {study.title}
                    </h4>
                    <div className="shrink-0 mt-0.5">
                      {isExpanded ? (
                        <CaretUp size={14} className="text-neutral-400" />
                      ) : (
                        <CaretDown size={14} className="text-neutral-400" />
                      )}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex gap-2 flex-wrap items-center mt-1.5">
                    {study.year && (
                      <span className="text-[10px] font-mono px-[6px] py-[1px] rounded bg-neutral-100 text-neutral-500">
                        {study.year}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-neutral-400">
                      {study.citation_count.toLocaleString()} citations
                    </span>
                    {study.journal && (
                      <span className="text-[10px] text-neutral-400 italic truncate max-w-[200px]">
                        {study.journal}
                      </span>
                    )}
                  </div>

                  {/* TL;DR (always visible if available and not expanded) */}
                  {study.tldr && !isExpanded && (
                    <p className="text-[12px] text-neutral-600 mt-2 leading-relaxed">
                      {study.tldr}
                    </p>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-neutral-100 pt-3">
                    {/* TL;DR */}
                    {study.tldr && (
                      <p className="text-[12px] text-neutral-800 mb-2.5 leading-relaxed font-medium">
                        TL;DR: {study.tldr}
                      </p>
                    )}

                    {/* Abstract */}
                    {study.abstract && (
                      <p className="text-[12px] text-neutral-600 leading-relaxed mb-3">
                        {study.abstract}
                      </p>
                    )}

                    {/* Authors */}
                    {authorsList.length > 0 && (
                      <div className="text-[11px] text-neutral-400 mb-3">
                        {authorsList.join(', ')}
                      </div>
                    )}

                    {/* Links */}
                    <div className="flex gap-2">
                      <a
                        href={study.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] px-2.5 py-1 rounded bg-neutral-100 text-primary-600 hover:text-primary-700 no-underline flex items-center gap-1 transition-colors"
                      >
                        <ArrowSquareOut size={10} /> View paper
                      </a>
                      {study.pdf_url && (
                        <a
                          href={study.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] px-2.5 py-1 rounded bg-neutral-100 text-primary-600 hover:text-primary-700 no-underline flex items-center gap-1 transition-colors"
                        >
                          <ArrowSquareOut size={10} /> PDF
                        </a>
                      )}
                      {study.doi && (
                        <a
                          href={`https://doi.org/${study.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] px-2.5 py-1 rounded bg-neutral-100 text-neutral-500 hover:text-neutral-700 no-underline transition-colors"
                        >
                          DOI
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && studies.length === 0 && !error && (
        <div className="text-center py-16">
          <BookOpen size={36} className="mx-auto mb-3 text-neutral-300" weight="duotone" />
          <p className="text-neutral-400 text-sm mb-4">
            No studies loaded for this segment yet.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-5 py-2.5 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-[filter] disabled:opacity-50"
            style={{ backgroundColor: color }}
          >
            {refreshing ? 'Fetching...' : 'Fetch Studies from Semantic Scholar'}
          </button>
        </div>
      )}

      {/* Continue button */}
      {!loading && (
        <div className="flex justify-end mt-6">
          <button
            onClick={onComplete}
            className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold hover:brightness-110 transition-[filter]"
            style={{ backgroundColor: color }}
          >
            Continue to Topics →
          </button>
        </div>
      )}
    </div>
  );
}
