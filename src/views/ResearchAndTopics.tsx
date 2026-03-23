import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MagnifyingGlass, UploadSimple, TextT, ArrowUpRight, TrendUp, Plus } from '@phosphor-icons/react';
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

type Tab = 'research' | 'import';
type ResearchState = 'idle' | 'running' | 'done';

export function ResearchAndTopics({ segmentId, onComplete }: Props) {
  const state = useStoreState();
  const actions = useActions();
  const segment = getSegment(segmentId);
  const segState = state.runs[state.activeRunId]?.segments[segmentId];
  const existingTopics = segState?.topics ?? [];

  const [tab, setTab] = useState<Tab>(existingTopics.length > 0 ? 'import' : 'research');
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
  const [autocompleteError, setAutocompleteError] = useState<string | null>(null);
  const addedSuggestionsRef = useRef(new Set<string>());

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

  // Fetch Google autocomplete when Reddit research finishes
  useEffect(() => {
    if (researchState !== 'done') return;
    if (autocompleteSuggestions.length > 0 || autocompleteLoading) return;

    const seedQueries = segment?.google_seed_queries ?? [];
    if (seedQueries.length === 0) return;

    setAutocompleteLoading(true);
    setAutocompleteError(null);

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
      .catch((err) => {
        console.error('Autocomplete fetch failed:', err);
        setAutocompleteError(err instanceof Error ? err.message : 'Failed to fetch suggestions');
      })
      .finally(() => setAutocompleteLoading(false));
  }, [researchState, segment, autocompleteSuggestions.length, autocompleteLoading]);

  // Add a single autocomplete suggestion as a topic
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

  // ── Import state ──
  const [pasteText, setPasteText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const color = segment?.color ?? '#E8457A';

  // Convert research results to topic briefs
  const convertResearchToTopics = useCallback(() => {
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
    setTopics(prev => [...prev, ...newTopics]);
    setTab('import'); // Switch to topics tab to show the list
  }, [visibleResults, segmentId]);

  // Parse pasted text into topics (one topic per line)
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

  // Handle CSV/JSON file upload
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
  }, [segmentId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Toggle topic selection
  const toggleTopic = (id: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  // Remove topic
  const removeTopic = (id: string) => {
    setTopics(prev => prev.filter(t => t.id !== id));
  };

  // Submit
  const selectedCount = topics.filter(t => t.selected).length;
  const handleSubmit = () => {
    const selected = topics.filter(t => t.selected);
    actions.setTopics(segmentId, selected);
    onComplete();
  };

  return (
    <div className="max-w-[800px] mx-auto">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-neutral-700 pb-0">
        <button
          onClick={() => setTab('research')}
          className={`px-4 py-2.5 text-sm font-medium border-none cursor-pointer transition-colors flex items-center gap-2 ${
            tab === 'research'
              ? 'text-neutral-50 border-b-2'
              : 'bg-transparent text-neutral-500 hover:text-neutral-300'
          }`}
          style={tab === 'research' ? { borderBottom: `2px solid ${color}`, color } : {}}
        >
          <MagnifyingGlass size={16} /> Research
        </button>
        <button
          onClick={() => setTab('import')}
          className={`px-4 py-2.5 text-sm font-medium border-none cursor-pointer transition-colors flex items-center gap-2 ${
            tab === 'import'
              ? 'text-neutral-50 border-b-2'
              : 'bg-transparent text-neutral-500 hover:text-neutral-300'
          }`}
          style={tab === 'import' ? { borderBottom: `2px solid ${color}`, color } : {}}
        >
          <UploadSimple size={16} /> Import / Paste
          {topics.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
              {topics.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══ Research Tab ═══ */}
      {tab === 'research' && (
        <>
          {researchState === 'idle' && (
            <div className="text-center py-16 max-w-[500px] mx-auto">
              <MagnifyingGlass size={44} weight="light" className="mx-auto mb-5" style={{ color, opacity: 0.85 }} />
              <h2 className="text-[22px] font-semibold mb-2">Pull real questions from the internet</h2>
              <p className="text-sm text-neutral-400 leading-relaxed mb-2">
                Search <span className="font-medium text-neutral-200">{segment?.display_name}</span> communities for real questions people are asking right now.
              </p>
              <p className="text-xs text-neutral-500 mb-8">
                Sources: {segment?.reddit_sources.join(', ')}, Google PAA
              </p>
              <button
                onClick={() => { setResearchState('running'); setVisibleResults([]); }}
                className="text-white text-sm font-semibold px-7 py-2.5 rounded-[10px] border-none cursor-pointer hover:brightness-110 transition-[filter]"
                style={{ backgroundColor: color }}
              >
                Start Research
              </button>
            </div>
          )}

          {(researchState === 'running' || researchState === 'done') && (
            <div>
              {researchState === 'running' && (
                <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-[10px] bg-neutral-800 border border-neutral-700">
                  <span className="pulse-dot inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm text-neutral-300">Searching <span className="font-medium text-neutral-100">{currentSource}</span>...</span>
                  <span className="ml-auto text-xs font-mono text-neutral-500">{visibleResults.length}/{allResults.length}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5 mb-4">
                {visibleResults.map((r, i) => (
                  <div key={i} className="animate-in bg-neutral-800 rounded-[10px] border border-neutral-700 p-3 px-3.5">
                    <p className="text-[13.5px] text-neutral-50 leading-relaxed mb-2">"{r.question}"</p>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <span className="text-[10px] font-mono px-[7px] py-[1px] rounded-full bg-neutral-700/50 text-neutral-400">{r.source}</span>
                      {r.votes && (
                        <span className="text-[10px] text-neutral-500 flex items-center gap-0.5">
                          <ArrowUpRight size={10} /> {r.votes}
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-[7px] py-[1px] rounded-full" style={{ color: emotionColor(r.emotion), backgroundColor: `color-mix(in srgb, ${emotionColor(r.emotion)} 12%, transparent)` }}>
                        {r.emotion}
                      </span>
                      {r.trending && (
                        <span className="text-[10px] font-mono px-[7px] py-[1px] rounded-full flex items-center gap-0.5" style={{ color, backgroundColor: `${color}15` }}>
                          <TrendUp size={10} /> trending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {researchState === 'done' && (
                <div className="flex justify-between items-center mt-4">
                  <span className="text-neutral-500 text-sm">{visibleResults.length} questions found</span>
                  <button
                    onClick={convertResearchToTopics}
                    className="text-white text-sm font-semibold px-6 py-2.5 rounded-[10px] border-none cursor-pointer hover:brightness-110 transition-[filter]"
                    style={{ backgroundColor: color }}
                  >
                    Convert to Topics →
                  </button>
                </div>
              )}

              {/* ── Google Autocomplete Results ── */}
              {researchState === 'done' && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <MagnifyingGlass size={14} style={{ color }} />
                    <span className="text-xs font-mono tracking-wide uppercase text-neutral-500">Google Searches</span>
                    {autocompleteLoading && (
                      <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full ml-1" style={{ backgroundColor: color }} />
                    )}
                  </div>

                  {autocompleteLoading && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-neutral-800 border border-neutral-700">
                      <span className="pulse-dot inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-neutral-300">Fetching Google autocomplete suggestions...</span>
                    </div>
                  )}

                  {autocompleteError && (
                    <div className="px-3 py-2.5 rounded-[10px] bg-neutral-800 border border-neutral-700 text-sm text-neutral-400">
                      Could not load autocomplete suggestions.
                    </div>
                  )}

                  {autocompleteSuggestions.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {autocompleteSuggestions.map((suggestion, i) => {
                        const isAdded = addedSuggestionsRef.current.has(suggestion);
                        return (
                          <div key={i} className="animate-in bg-neutral-800 rounded-[10px] border border-neutral-700 p-3 px-3.5 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13.5px] text-neutral-50 leading-relaxed">{suggestion}</p>
                              <div className="flex gap-1.5 mt-1.5">
                                <span className="text-[10px] font-mono px-[7px] py-[1px] rounded-full bg-neutral-700/50 text-neutral-400">Google</span>
                              </div>
                            </div>
                            <button
                              onClick={() => addSuggestionAsTopic(suggestion)}
                              disabled={isAdded}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-none text-xs font-semibold cursor-pointer hover:brightness-110 transition-[filter] disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                              style={{ backgroundColor: isAdded ? 'var(--color-neutral-700)' : `${color}20`, color: isAdded ? 'var(--color-neutral-500)' : color }}
                            >
                              <Plus size={12} weight="bold" />
                              {isAdded ? 'Added' : 'Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ Import / Paste Tab ═══ */}
      {tab === 'import' && (
        <>
          {/* Paste zone */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <TextT size={14} className="text-neutral-500" />
              <span className="text-xs text-neutral-500 font-mono tracking-wide uppercase">Paste topics (one per line)</span>
            </div>
            <div className="flex gap-2">
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Why does GLP-1 cause hair loss at month 3?\nIs biotin actually effective for postpartum shedding?\nBest supplements for perimenopause hair thinning"}
                className="flex-1 px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-50 text-sm resize-y min-h-[80px] placeholder:text-neutral-600 focus:border-primary-500 focus:outline-none font-sans"
              />
              <button
                onClick={parsePastedTopics}
                disabled={!pasteText.trim()}
                className="self-end px-4 py-2.5 rounded-lg border-none text-white text-xs font-semibold cursor-pointer hover:brightness-110 transition-[filter] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: color }}
              >
                Add
              </button>
            </div>
          </div>

          {/* File upload zone */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <UploadSimple size={14} className="text-neutral-500" />
              <span className="text-xs text-neutral-500 font-mono tracking-wide uppercase">Or upload CSV / JSON</span>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="h-[80px] rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all duration-150"
              style={{
                border: dragOver ? `2px solid ${color}` : '2px dashed var(--color-neutral-600)',
                backgroundColor: dragOver ? `${color}10` : 'transparent',
              }}
            >
              <UploadSimple size={18} className="text-neutral-500" />
              <span className="text-sm text-neutral-500">Drop .csv or .json, or click to browse</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Import errors */}
          {importErrors.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20">
              {importErrors.map((err, i) => (
                <p key={i} className="text-xs text-error font-mono">{err}</p>
              ))}
            </div>
          )}

          {/* Topic list */}
          {topics.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold">{topics.length} topics</span>
                <span className="text-xs text-neutral-500">{selectedCount} selected</span>
              </div>
              <div className="flex flex-col gap-1.5 mb-4">
                {topics.map(topic => (
                  <div
                    key={topic.id}
                    className="bg-neutral-800 rounded-[10px] border border-neutral-700 p-3 px-3.5 transition-[border-color] duration-150"
                    style={topic.selected ? { borderLeftWidth: 3, borderLeftColor: color, backgroundColor: `${color}08` } : {}}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        onClick={() => toggleTopic(topic.id)}
                        className="w-5 h-5 rounded-[5px] flex-shrink-0 mt-0.5 flex items-center justify-center cursor-pointer transition-all duration-150"
                        style={{
                          border: `2px solid ${topic.selected ? color : 'var(--color-neutral-600)'}`,
                          backgroundColor: topic.selected ? color : 'transparent',
                        }}
                      >
                        {topic.selected && <span className="text-white text-[11px] font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-serif text-neutral-50 leading-tight mb-1">{topic.headline}</div>
                        <div className="text-xs text-neutral-500 mb-1.5">Answering: <em>"{topic.source_question}"</em></div>
                        <div className="flex gap-1.5 flex-wrap items-center">
                          <span className="text-[10px] font-mono px-[7px] py-[1px] rounded-full" style={{ color: emotionColor(topic.emotion), backgroundColor: `color-mix(in srgb, ${emotionColor(topic.emotion)} 12%, transparent)` }}>
                            {topic.emotion}
                          </span>
                          {topic.freshness === 'trending' && (
                            <span className="text-[10px] font-mono px-[7px] py-[1px] rounded-full" style={{ color, backgroundColor: `${color}15` }}>trending</span>
                          )}
                          <span className="text-[10px] text-neutral-600">✉ {topic.suggested_subject_line}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeTopic(topic.id)}
                        className="text-neutral-600 hover:text-neutral-400 bg-transparent border-none cursor-pointer text-sm"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Submit */}
          {topics.length > 0 && (
            <div className="flex justify-between items-center mt-4">
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
          )}

          {topics.length === 0 && (
            <div className="text-center py-10 text-neutral-600 text-sm">
              No topics yet. Paste some above, upload a CSV, or run research first.
            </div>
          )}
        </>
      )}
    </div>
  );
}
