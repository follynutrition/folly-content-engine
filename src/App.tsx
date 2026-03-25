import { useState, useCallback, useRef, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { PhaseStepper } from '@/components/PhaseStepper';
import { Breadcrumb } from '@/components/Breadcrumb';
import { RunHome } from '@/views/RunHome';
import { Topics } from '@/views/Topics';
import { ContentGeneration } from '@/views/ContentGeneration';
import { Review } from '@/views/Review';
import { Publish } from '@/views/Publish';
import { CommandPalette } from '@/components/CommandPalette';
import { StateContext, ActionsContext, loadState, saveState } from '@/lib/store';
import type { AppState, ContentPackage, TopicBrief, TopicStatus, ScheduleEntry, PublishReceipt } from '@/lib/types';

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist state to localStorage as a side-effect
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Actions object is stable (never changes reference).
  // Each method uses setState's functional updater so it always reads fresh state.
  const actions = useRef({
    getActiveRun() {
      const s = stateRef.current;
      return s.runs[s.activeRunId];
    },
    getSegmentState(segId: string) {
      const s = stateRef.current;
      return s.runs[s.activeRunId]?.segments[segId];
    },
    setSegmentPhase(segId: string, phase: number) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        run.segments = { ...run.segments, [segId]: { ...run.segments[segId], phase } };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    setTopics(segId: string, topics: TopicBrief[]) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        run.segments = { ...run.segments, [segId]: { ...run.segments[segId], topics } };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    addTopics(segId: string, newTopics: TopicBrief[]) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        const segState = { ...run.segments[segId] };
        segState.topics = [...newTopics, ...segState.topics];
        run.segments = { ...run.segments, [segId]: segState };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    updateTopicStatus(segId: string, topicIds: string[], status: TopicStatus) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        const segState = { ...run.segments[segId] };
        const idSet = new Set(topicIds);
        segState.topics = segState.topics.map(t =>
          idSet.has(t.id) ? { ...t, status } : t
        );
        run.segments = { ...run.segments, [segId]: segState };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    setPackages(segId: string, packages: ContentPackage[]) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        run.segments = { ...run.segments, [segId]: { ...run.segments[segId], packages } };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    updatePackage(segId: string, pkgId: string, updates: Partial<ContentPackage>) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        const segState = { ...run.segments[segId] };
        segState.packages = segState.packages.map(p =>
          p.id === pkgId ? { ...p, ...updates } : p
        );
        run.segments = { ...run.segments, [segId]: segState };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    setSchedule(segId: string, schedule: ScheduleEntry[]) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        run.segments = { ...run.segments, [segId]: { ...run.segments[segId], schedule } };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    setPublishReceipt(segId: string, receipt: PublishReceipt) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId] };
        run.segments = { ...run.segments, [segId]: { ...run.segments[segId], publishReceipt: receipt } };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
    setRunLabel(label: string) {
      setState(prev => {
        const run = { ...prev.runs[prev.activeRunId], label };
        return { ...prev, runs: { ...prev.runs, [prev.activeRunId]: run } };
      });
    },
  }).current;

  const run = state.runs[state.activeRunId];
  const currentPhase = activeSegment ? (run?.segments[activeSegment]?.phase ?? 0) : -1;

  const handlePhaseClick = useCallback((phase: number) => {
    if (activeSegment) {
      actions.setSegmentPhase(activeSegment, phase);
    }
  }, [activeSegment, actions]);

  const advancePhase = useCallback(() => {
    if (activeSegment) {
      const current = stateRef.current.runs[stateRef.current.activeRunId]?.segments[activeSegment]?.phase ?? 0;
      actions.setSegmentPhase(activeSegment, Math.min(current + 1, 4));
    }
  }, [activeSegment, actions]);

  const goHome = useCallback(() => setActiveSegment(null), []);

  // Cmd+K command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <ActionsContext.Provider value={actions}>
    <StateContext.Provider value={state}>
      <div className="w-full min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        <CommandPalette
          isOpen={cmdPaletteOpen}
          onClose={() => setCmdPaletteOpen(false)}
          onNavigate={setActiveSegment}
        />
        <TopBar
          activeSegment={activeSegment}
          onSegmentSelect={setActiveSegment}
          onHome={goHome}
        />

        {activeSegment && currentPhase < 4 && (
          <>
            <PhaseStepper
              segmentId={activeSegment}
              currentPhase={currentPhase}
              onPhaseClick={handlePhaseClick}
            />
            <Breadcrumb segmentId={activeSegment} currentPhase={currentPhase} />
          </>
        )}

        <div className="px-6 py-7">
          {!activeSegment && (
            <RunHome onSegmentSelect={setActiveSegment} />
          )}

          {activeSegment && currentPhase === 0 && (
            <Topics segmentId={activeSegment} onComplete={advancePhase} />
          )}
          {activeSegment && currentPhase === 1 && (
            <ContentGeneration segmentId={activeSegment} onComplete={advancePhase} />
          )}
          {activeSegment && currentPhase === 2 && (
            <Review segmentId={activeSegment} onComplete={advancePhase} />
          )}
          {activeSegment && currentPhase === 3 && (
            <Publish segmentId={activeSegment} onComplete={advancePhase} />
          )}

          {activeSegment && currentPhase >= 4 && (
            <div className="text-center py-20">
              <div className="w-[52px] h-[52px] rounded-full bg-success flex items-center justify-center mx-auto mb-4 text-xl text-white">
                ✓
              </div>
              <h2 className="text-[22px] font-semibold mb-2">Segment complete</h2>
              <p className="text-neutral-500 mb-5">All packages published.</p>
              <button
                onClick={goHome}
                className="px-7 py-3 rounded-[10px] border-none cursor-pointer text-white text-sm font-semibold bg-primary-500 hover:brightness-110 transition-[filter]"
              >
                ← Back to Run Home
              </button>
            </div>
          )}
        </div>
      </div>
    </StateContext.Provider>
    </ActionsContext.Provider>
  );
}
