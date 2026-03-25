import { useState, useCallback } from 'react';
import { SpinnerGap, Check, X, Funnel, ArrowRight, Lightning } from '@phosphor-icons/react';
import { getSegment } from '@/lib/config';
import { useStoreState, useActions } from '@/lib/store';
import { generateId } from '@/lib/utils';
import type { TopicBrief, TopicStatus, EmotionTag } from '@/lib/types';

interface Props {
  segmentId: string;
  onComplete: () => void;
}

type FilterTab = 'all' | TopicStatus;

const STATUS_CONFIG: Record<TopicStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  approved: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  rejected: { label: 'Rejected', color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  content_generated: { label: 'Content Generated', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
  published: { label: 'Published', color: 'text-neutral-400', bg: 'bg-neutral-50 border-neutral-200' },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'content_generated', label: 'Generated' },
  { key: 'published', label: 'Published' },
];

const EMOTION_COLORS: Record<string, string> = {
  scared: 'bg-red-100 text-red-700',
  confused: 'bg-amber-100 text-amber-700',
  anxious: 'bg-orange-100 text-orange-700',
  frustrated: 'bg-yellow-100 text-yellow-700',
  angry: 'bg-red-100 text-red-700',
  worried: 'bg-orange-100 text-orange-700',
  desperate: 'bg-red-100 text-red-700',
  panicked: 'bg-red-100 text-red-700',
  hopeful: 'bg-emerald-100 text-emerald-700',
  seeking: 'bg-blue-100 text-blue-700',
};

export function Topics({ segmentId, onComplete }: Props) {
  const state = useStoreState();
  const actions = useActions();
  const segment = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const topics = segState?.topics ?? [];

  const [filter, setFilter] = useState<FilterTab>('all');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTopics = filter === 'all'
    ? topics
    : topics.filter(t => (t.status ?? 'new') === filter);

  const approvedCount = topics.filter(t => t.status === 'approved').length;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: segmentId, count: 10 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `API returned ${res.status}`);
      }

      const data = await res.json();
      const newTopics: TopicBrief[] = (data.topics ?? []).map((t: Record<string, unknown>) => ({
        id: generateId(),
        headline: t.headline as string,
        source_question: t.headline as string,
        emotion: (t.emotion as EmotionTag) ?? 'seeking',
        folly_hook: t.folly_hook as string ?? '',
        suggested_subject_line: t.suggested_subject_line as string ?? '',
        segment: segmentId,
        freshness: 'evergreen' as const,
        selected: true,
        preview_text: t.preview_text as string ?? '',
        email_body_draft: t.email_body_draft as string ?? '',
        cta_text: t.cta_text as string ?? '',
        rationale: t.rationale as string ?? '',
        linked_study_ids: t.linked_study_ids as number[] ?? [],
        status: 'new' as TopicStatus,
      }));

      if (newTopics.length > 0) {
        actions.addTopics(segmentId, newTopics);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate topics');
    } finally {
      setGenerating(false);
    }
  }, [segmentId, actions]);

  const handleApprove = useCallback((topicId: string) => {
    actions.updateTopicStatus(segmentId, [topicId], 'approved');
  }, [segmentId, actions]);

  const handleReject = useCallback((topicId: string) => {
    actions.updateTopicStatus(segmentId, [topicId], 'rejected');
  }, [segmentId, actions]);

  const handleAdvance = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const getStatusBadge = (status: TopicStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${config.bg} ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getCounts = () => {
    const counts: Record<string, number> = { all: topics.length };
    for (const t of topics) {
      const s = t.status ?? 'new';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  };

  const counts = getCounts();

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-neutral-900">
          Topics — <span style={{ color: segment?.color ?? '#5B9A8B' }}>{segment?.display_name}</span>
        </h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg border-none text-white text-sm font-semibold cursor-pointer hover:brightness-110 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ backgroundColor: '#5B9A8B' }}
        >
          {generating ? (
            <>
              <SpinnerGap size={14} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Lightning size={14} weight="fill" />
              Generate 10 More
            </>
          )}
        </button>
      </div>
      <p className="text-sm text-neutral-500 mb-5">
        AI-generated topic briefs backed by real studies and Google search trends. Approve topics to advance to content generation.
      </p>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <X size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Generation failed</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 pb-2 border-b border-neutral-200">
        <Funnel size={14} className="text-neutral-400 mr-1" />
        {FILTER_TABS.map(tab => {
          const count = counts[tab.key] ?? 0;
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border-none transition-all ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'bg-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 ${isActive ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Topic list */}
      {filteredTopics.length === 0 && !generating && (
        <div className="text-center py-16">
          <div className="text-neutral-300 mb-3">
            <Lightning size={40} />
          </div>
          <h3 className="text-base font-semibold text-neutral-700 mb-1">No topics yet</h3>
          <p className="text-sm text-neutral-500 mb-4">
            Click "Generate 10 More" to create AI-powered topic briefs for this segment.
          </p>
        </div>
      )}

      {/* Generating skeleton */}
      {generating && topics.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="skeleton h-5 w-16 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
              </div>
              <div className="skeleton h-6 w-[85%] mb-2 rounded" />
              <div className="skeleton h-4 w-[70%] mb-2 rounded" />
              <div className="skeleton h-12 w-full mb-2 rounded" />
              <div className="skeleton h-3 w-[60%] rounded" />
            </div>
          ))}
        </div>
      )}

      {filteredTopics.length > 0 && (
        <div className="space-y-3">
          {filteredTopics.map(topic => {
            const status = topic.status ?? 'new';
            const emotionClass = EMOTION_COLORS[topic.emotion] ?? 'bg-neutral-100 text-neutral-600';

            return (
              <div
                key={topic.id}
                className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${
                  status === 'rejected' ? 'opacity-50 border-neutral-200' : 'border-neutral-200'
                }`}
              >
                {/* Top row: status + emotion */}
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(status)}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${emotionClass}`}>
                    {topic.emotion}
                  </span>
                  {topic.linked_study_ids && topic.linked_study_ids.length > 0 && (
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {topic.linked_study_ids.length} {topic.linked_study_ids.length === 1 ? 'study' : 'studies'} linked
                    </span>
                  )}
                </div>

                {/* Headline */}
                <h3 className="text-base font-bold text-neutral-900 leading-snug mb-1.5">
                  {topic.headline}
                </h3>

                {/* Subject line + preview text */}
                {(topic.suggested_subject_line || topic.preview_text) && (
                  <div className="mb-2">
                    <p className="text-sm text-neutral-600">
                      <span className="font-medium text-neutral-500">SL:</span>{' '}
                      {topic.suggested_subject_line}
                    </p>
                    {topic.preview_text && (
                      <p className="text-sm text-neutral-500">
                        <span className="font-medium text-neutral-400">Preview:</span>{' '}
                        {topic.preview_text}
                      </p>
                    )}
                  </div>
                )}

                {/* Email body draft */}
                {topic.email_body_draft && (
                  <div className="mb-2 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                    <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide mb-1">
                      Email teaser
                    </p>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {topic.email_body_draft}
                    </p>
                    {topic.cta_text && (
                      <p className="text-xs font-semibold text-emerald-600 mt-1.5">
                        {topic.cta_text}
                      </p>
                    )}
                  </div>
                )}

                {/* Folly hook */}
                {topic.folly_hook && (
                  <p className="text-xs text-neutral-500 mb-2">
                    <span className="font-medium">Hook:</span> {topic.folly_hook}
                  </p>
                )}

                {/* Rationale */}
                {topic.rationale && (
                  <p className="text-xs text-neutral-400 italic mb-3">
                    {topic.rationale}
                  </p>
                )}

                {/* Actions */}
                {status === 'new' && (
                  <div className="flex gap-2 pt-2 border-t border-neutral-100">
                    <button
                      onClick={() => handleApprove(topic.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none text-white transition-all hover:brightness-110"
                      style={{ backgroundColor: '#5B9A8B' }}
                    >
                      <Check size={12} weight="bold" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(topic.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-red-200 bg-white text-red-500 transition-all hover:bg-red-50"
                    >
                      <X size={12} weight="bold" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom bar: advance to content gen */}
      {approvedCount > 0 && (
        <div className="sticky bottom-0 bg-neutral-50/95 backdrop-blur-sm py-4 -mx-6 px-6 flex justify-between items-center border-t border-neutral-200 mt-6">
          <span className="text-sm text-neutral-500">
            {approvedCount} approved {approvedCount === 1 ? 'topic' : 'topics'} ready
          </span>
          <button
            onClick={handleAdvance}
            className="flex items-center gap-2 text-white text-sm font-semibold px-6 py-2.5 rounded-[10px] border-none cursor-pointer hover:brightness-110 transition-[filter]"
            style={{ backgroundColor: '#5B9A8B' }}
          >
            Generate Content for {approvedCount}
            <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      )}

      {/* Generating overlay at bottom */}
      {generating && topics.length > 0 && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <SpinnerGap size={18} className="animate-spin text-emerald-600" />
          <span className="text-sm text-emerald-700 font-medium">
            Generating more topics from studies and Google trends...
          </span>
        </div>
      )}
    </div>
  );
}
