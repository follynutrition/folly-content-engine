import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MagnifyingGlass, UploadSimple, Plus, X, TrendUp, CaretDown, CaretUp, CheckSquare, Square } from '@phosphor-icons/react';
import { getSegment } from '@/lib/config';
import { useStoreState, useActions } from '@/lib/store';
import { getMockResearchResults } from '@/lib/search-mock';
import { parseCSV } from '@/lib/csv-parser';
import { validateTopics } from '@/lib/schema-validator';
import { emotionColor, generateId } from '@/lib/utils';
import type { ResearchResult, TopicBrief, EmotionTag } from '@/lib/types';

interface Props {
  segmentId: string;
  onComplete: () => void;
}

type ResearchState = 'idle' | 'running' | 'done';

const TOPIC_TARGET = 25;

export function ResearchAndTopics({ segmentId, onComplete }: Props) {
  const state = useStoreState();
  const actions = useActions();
  const segment = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const existingTopics = segState?.topics ?? [];

  const [topics, setTopics] = useState<TopicBrief[]>(existingTopics);

  // ── Research state ──
  const allResults = useMemo(() => getMockResearchResults(segmentId), [segmentId]);
  const [researchState, setResearchState] = useState<ResearchState>('idle');
  const [visibleResults, setVisibleResults] = useState<ResearchResult[]>([]);
  const [currentSource, setCurrentSource] = useState('');

  const sources = useMemo(() =>
    segment ? [...segment.reddit_sources, 'Google PAA'] : ['Google PAA'],
    [segment]
  );

  // ── Google Autocomplete state ──
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const addedSuggestionsRef = useRef(new Set<string>());

  // ── Add Topics panel open/closed ──
  const [addPanelOpen, setAddPanelOpen] = useState(topics.length === 0);
  const [pasteText, setPasteText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── Expanded topic details ──
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const color = segment?.color ?? '#E8457A';

  // Stream research results
  useEffect(() => {
    if (researchState !== 'running') return;
    const idx = visibleResults.length;
    if (idx >= allResults.length) {
      setResearchState('done');
      return;
    }
    const timer = setTimeout(() => {
      setVisibleResults(prev => [...prev, allResults[idx]]);
      setCurrentSource(sources[idx % sources.length]);
    }, 350);
    return () => clearTimeout(timer);
  }, [researchState, visibleResults.length, allResults, sources]);

  // Auto-convert research results to topics when research is done
  useEffect(() => {
    if (researchState !== 'done') return;

    const newTopics: TopicBrief[] = visibleResults.map(r => ({
      id: generateId(),
      headline: r.question.length > 80 ? r.question.substring(0, 77) + '...' : r.question,
      source_question: r.question,
      emotion: r.emotion,
      folly_hook: 'Folly\'s microsphere delivery system protects key nutrients through compromised digestion',
      suggested_subject_line: r.question.substring(0, 45),
      segment: segmentId,
      freshness: r.trending ? 'trending' as const : 'evergreen' as const,
      selected: true,
    }));

    setTopics(prev => {
      // Avoid duplicates by checking source_question
      const existingQuestions = new Set(prev.map(t => t.source_question));
      const unique = newTopics.filter(t => !existingQuestions.has(t.source_question));
      return [...prev, ...unique];
    });

    // Close the add panel since we now have topics
    setAddPanelOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchState]);

  // Fetch Google autocomplete when research finishes
  useEffect(() => {
    if (researchState !== 'done') return;
    if (autocompleteSuggestions.length > 0 || autocompleteLoading) return;
    const seedQueries = segment?.google_seed_queries ?? [];
    if (seedQueries.length === 0) return;

    setAutocompleteLoading(true);
    fetch('/api/autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: seedQueries }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();
        setAutocompleteSuggestions(data.suggestions ?? []);
      })
      .catch(() => {})
      .finally(() => setAutocompleteLoading(false));
  }, [researchState, segment, autocompleteSuggestions.length, autocompleteLoading]);

  // Add autocomplete suggestion as topic
  const addSuggestionAsTopic = useCallback((suggestion: string) => {
    if (addedSuggestionsRef.current.has(suggestion)) return;
    addedSuggestionsRef.current.add(suggestion);
    const topic: TopicBrief = {
      id: generateId(),
      headline: suggestion.length > 80 ? suggestion.substring(0, 77) + '...' : suggestion,
      source_question: suggestion,
      emotion: 'seeking' as EmotionTag,
      folly_hook: 'Folly\'s microsphere delivery system protects key nutrients through compromised digestion',
      suggested_subject_line: suggestion.substring(0, 45),
      segment: segmentId,
      freshness: 'evergreen' as const,
      selected: true,
    };
    setTopics(prev => [...prev, topic]);
  }, [segmentId]);

  // Parse pasted topics
  const parsePastedTopics = useCallback(() => {
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const newTopics: TopicBrief[] = lines.map(line => ({
      id: generateId(),
      headline: line.length > 80 ? line.substring(0, 77) + '...' : line,
      source_question: line,
      emotion: 'seeking' as EmotionTag,
      folly_hook: 'Folly\'s microsphere delivery system protects key nutrients through compromised digestion',
      suggested_subject_line: line.substring(0, 45),
      segment: segmentId,
      freshness: 'evergreen' as const,
      selected: true,
    }));
    setTopics(prev => [...prev, ...newTopics]);
    setPasteText('');
  }, [pasteText, segmentId]);

  // Handle file upload
  const handleFile = useCallback((file: File) => {
    setImportErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let parsed: Record<string, string>[];
        if (file.name.endsWith('.json')) {
          parsed = JSON.parse(text);
        } else {
          parsed = parseCSV(text);
        }
        const result = validateTopics(parsed);
        if (result.errors.length > 0) {
          setImportErrors(result.errors.map(err => `Row ${err.row}: ${err.message}`).slice(0, 10));
        }
        if (result.valid.length > 0) {
          setTopics(prev => [...prev, ...result.valid]);
        }
      } catch (err) {
        setImportErrors([`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`]);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Toggle selection
  const toggleTopic = (id: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };
  const removeTopic = (id: string) => {
    setTopics(prev => prev.filter(t => t.id !== id));
  };

  // Select all / deselect all
  const selectedCount = topics.filter(t => t.selected).length;
  const allSelected = topics.length > 0 && selectedCount === topics.length;
  const toggleAll = () => {
    const newVal = !allSelected;
    setTopics(prev => prev.map(t => ({ ...t, selected: newVal })));
  };

  // Submit
  const handleSubmit = () => {
    const selected = topics.filter(t => t.selected);
    actions.setTopics(segmentId, selected);
    onComplete();
  };

  return (
    <div className="max-w-[800px] mx-auto">
      {/* ═══ Add Topics Panel (collapsible) ═══ */}
      <div className="mb-6">
        <button
          onClick={() => setAddPanelOpen(!addPanelOpen)}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-600 bg-transparent border-none cursor-pointer hover:text-neutral-800 transition-colors mb-3"
        >
          {addPanelOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
          Add Topics
          {topics.length > 0 && !addPanelOpen && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full ml-1" style={{ backgroundColor: `${color}20`, color }}>
              {topics.length} added
            </span>
          )}
        </button>

        {addPanelOpen && (
          <div className="bg-white rounded-xl border border-neutral-200 p-5 animate-in">
            {/* Three options in a row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Research button */}
              <button
                onClick={() => { setResearchState('running'); setVisibleResults([]); }}
                disabled={researchState === 'running'}
                className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 cursor-pointer hover:border-neutral-300 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <MagnifyingGlass size={20} className="mb-2" style={{ color }} />
                <div className="text-sm font-semibold text-neutral-700 mb-0.5">Research</div>
                <div className="text-[11px] text-neutral-400 leading-snug">
                  Pull questions from {segment?.reddit_sources?.[0] ?? 'Reddit'} + Google
                </div>
              </button>

              {/* Paste area */}
              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50">
                <Plus size={20} className="mb-2 text-neutral-500" />
                <div className="text-sm font-semibold text-neutral-700 mb-1.5">Paste</div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="One topic per line..."
                  className="w-full px-2 py-1.5 rounded-md bg-neutral-50 border border-neutral-200 text-neutral-800 text-[11px] resize-none h-[48px] placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none font-sans"
                />
                {pasteText.trim() && (
                  <button
                    onClick={parsePastedTopics}
                    className="mt-1.5 text-[11px] font-semibold px-3 py-1 rounded-md border-none text-white cursor-pointer hover:brightness-110 transition-[filter]"
                    style={{ backgroundColor: color }}
                  >
                    Add
                  </button>
                )}
              </div>

              {/* File upload */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-lg cursor-pointer transition-all"
                style={{
                  border: dragOver ? `2px solid ${color}` : '2px dashed var(--color-neutral-300)',
                  backgroundColor: dragOver ? `${color}10` : 'rgba(250,250,250,0.5)',
                }}
              >
                <UploadSimple size={20} className="mb-2 text-neutral-500" />
                <div className="text-sm font-semibold text-neutral-700 mb-0.5">Upload</div>
                <div className="text-[11px] text-neutral-400 leading-snug">
                  Drop .csv or .json
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {/* Research streaming area */}
            {researchState === 'running' && (
              <div className="mt-2">
                <div className="flex items-center gap-3 mb-3 px-2 py-2 rounded-lg bg-neutral-50">
                  <span className="pulse-dot inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm text-neutral-600">Searching <span className="font-medium text-neutral-800">{currentSource}</span>...</span>
                  <span className="ml-auto text-xs font-mono text-neutral-400">{visibleResults.length}/{allResults.length}</span>
                </div>
                <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                  {visibleResults.slice(-5).map((r, i) => (
                    <div key={i} className="animate-in flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-neutral-600">
                      <span className="text-neutral-400 font-mono text-[10px] w-8 flex-shrink-0">{r.source.replace('r/', '')}</span>
                      <span className="flex-1 truncate">{r.question}</span>
                      {r.trending && <TrendUp size={10} style={{ color }} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google autocomplete results */}
            {researchState === 'done' && autocompleteSuggestions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-200">
                <div className="text-[10px] text-neutral-400 font-mono uppercase tracking-wide mb-2">Google Suggestions</div>
                <div className="flex flex-wrap gap-1.5">
                  {autocompleteSuggestions.map((s, i) => {
                    const isAdded = addedSuggestionsRef.current.has(s);
                    return (
                      <button
                        key={i}
                        onClick={() => addSuggestionAsTopic(s)}
                        disabled={isAdded}
                        className="text-[11px] px-2.5 py-1 rounded-full border-none cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                        style={{
                          backgroundColor: isAdded ? 'var(--color-neutral-200)' : `${color}15`,
                          color: isAdded ? 'var(--color-neutral-400)' : color,
                        }}
                      >
                        <Plus size={10} weight="bold" />
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Import errors */}
            {importErrors.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-error/10 border border-error/20">
                {importErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-error font-mono">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Topic List ═══ */}
      {topics.length > 0 && (
        <>
          {/* Header with target indicator and select all */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs text-neutral-500 bg-transparent border-none cursor-pointer hover:text-neutral-700 transition-colors"
              >
                {allSelected ? <CheckSquare size={14} weight="fill" style={{ color }} /> : <Square size={14} />}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-xs text-neutral-400">{selectedCount} of {topics.length} selected</span>
            </div>

            {/* Target indicator */}
            <div className="flex items-center gap-2">
              <div className="w-20 h-1 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min((topics.length / TOPIC_TARGET) * 100, 100)}%`,
                    backgroundColor: topics.length >= TOPIC_TARGET ? 'var(--color-success)' : color,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                {topics.length}/{TOPIC_TARGET}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-4">
            {topics.map(topic => {
              const isExpanded = expandedTopic === topic.id;
              return (
                <div
                  key={topic.id}
                  className="bg-white rounded-[10px] border border-neutral-200 transition-[border-color] duration-150"
                  style={topic.selected ? { borderLeftWidth: 3, borderLeftColor: color } : {}}
                >
                  {/* Compact row */}
                  <div className="flex items-center gap-3 p-3 px-3.5">
                    <div
                      onClick={() => toggleTopic(topic.id)}
                      className="w-4.5 h-4.5 rounded-[4px] flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150"
                      style={{
                        width: 18, height: 18,
                        border: `2px solid ${topic.selected ? color : 'var(--color-neutral-300)'}`,
                        backgroundColor: topic.selected ? color : 'transparent',
                      }}
                    >
                      {topic.selected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13.5px] text-neutral-900 leading-tight">{topic.headline}</span>
                    </div>
                    <span
                      className="text-[10px] font-mono px-[7px] py-[1px] rounded-full flex-shrink-0"
                      style={{ color: emotionColor(topic.emotion), backgroundColor: `color-mix(in srgb, ${emotionColor(topic.emotion)} 12%, transparent)` }}
                    >
                      {topic.emotion}
                    </span>
                    {topic.freshness === 'trending' && (
                      <span className="text-[10px] font-mono px-[7px] py-[1px] rounded-full flex-shrink-0 flex items-center gap-0.5" style={{ color, backgroundColor: `${color}15` }}>
                        <TrendUp size={9} /> trending
                      </span>
                    )}
                    <button
                      onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
                      className="text-neutral-400 hover:text-neutral-500 bg-transparent border-none cursor-pointer text-xs flex-shrink-0"
                    >
                      {isExpanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
                    </button>
                    <button
                      onClick={() => removeTopic(topic.id)}
                      className="text-neutral-400 hover:text-neutral-500 bg-transparent border-none cursor-pointer flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3 pt-0 border-t border-neutral-200/50 ml-[34px]">
                      <div className="text-[11px] text-neutral-400 mt-2 mb-1">
                        Source: <em>"{topic.source_question}"</em>
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Subject line: <span className="text-neutral-500">{topic.suggested_subject_line}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit */}
          <div className="flex justify-between items-center mt-5 sticky bottom-0 bg-white/90 backdrop-blur-md py-4 -mx-6 px-6 border-t border-neutral-200">
            <span className="text-neutral-500 text-sm">{selectedCount} topics selected</span>
            <button
              onClick={handleSubmit}
              disabled={selectedCount < 1}
              className="text-white text-sm font-semibold px-7 py-2.5 rounded-[10px] border-none cursor-pointer hover:brightness-110 transition-[filter] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: color }}
            >
              Generate Content for {selectedCount} →
            </button>
          </div>
        </>
      )}

      {topics.length === 0 && !addPanelOpen && (
        <div className="text-center py-10 text-neutral-400 text-sm">
          No topics yet.{' '}
          <button onClick={() => setAddPanelOpen(true)} className="text-primary-500 bg-transparent border-none cursor-pointer underline">
            Add some
          </button>{' '}
          to get started.
        </div>
      )}
    </div>
  );
}
