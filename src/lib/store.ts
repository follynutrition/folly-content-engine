import { createContext, useContext } from 'react';
import type { AppState, Run, SegmentState, TopicBrief, TopicStatus, ContentPackage, ScheduleEntry, PublishReceipt } from './types';
import { segments } from './config';

const STORAGE_KEY = 'folly-content-engine';

function createDefaultSegmentState(): SegmentState {
  return {
    phase: 0,
    topics: [],
    packages: [],
    schedule: [],
    publishReceipt: null,
  };
}

function getCurrentRunId(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  return `${month.toLowerCase()}-${now.getFullYear()}`;
}

function getCurrentRunLabel(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  return `${month} ${now.getFullYear()} — Draft`;
}

function createDefaultRun(): Run {
  const now = new Date();
  const segmentStates: Record<string, SegmentState> = {};
  for (const seg of segments) {
    segmentStates[seg.id] = createDefaultSegmentState();
  }
  return {
    id: getCurrentRunId(),
    month: now.getMonth(),
    year: now.getFullYear(),
    label: getCurrentRunLabel(),
    segments: segmentStates,
  };
}

function createDefaultState(): AppState {
  const run = createDefaultRun();
  return {
    runs: { [run.id]: run },
    activeRunId: run.id,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Ensure active run exists
      if (!parsed.runs[parsed.activeRunId]) {
        const run = createDefaultRun();
        parsed.runs[run.id] = run;
        parsed.activeRunId = run.id;
      }
      // Ensure all segments exist in active run
      const activeRun = parsed.runs[parsed.activeRunId];
      for (const seg of segments) {
        if (!activeRun.segments[seg.id]) {
          activeRun.segments[seg.id] = createDefaultSegmentState();
        }
      }
      return parsed;
    }
  } catch {
    // Fall through to default
  }
  return createDefaultState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable
  }
}

// --- Context ---

export interface StoreActions {
  getActiveRun(): Run;
  getSegmentState(segId: string): SegmentState;
  setSegmentPhase(segId: string, phase: number): void;
  setTopics(segId: string, topics: TopicBrief[]): void;
  addTopics(segId: string, topics: TopicBrief[]): void;
  updateTopicStatus(segId: string, topicIds: string[], status: TopicStatus): void;
  setPackages(segId: string, packages: ContentPackage[]): void;
  updatePackage(segId: string, pkgId: string, updates: Partial<ContentPackage>): void;
  setSchedule(segId: string, schedule: ScheduleEntry[]): void;
  setPublishReceipt(segId: string, receipt: PublishReceipt): void;
}

export interface StoreContextValue {
  state: AppState;
  actions: StoreActions;
}

// Two separate contexts: state changes frequently, actions never change.
// This prevents re-renders in components that only need actions.
export const StateContext = createContext<AppState | null>(null);
export const ActionsContext = createContext<StoreActions | null>(null);

/** Returns both state and actions. Components using this re-render on every state change. */
export function useStore(): StoreContextValue {
  const state = useContext(StateContext);
  const actions = useContext(ActionsContext);
  if (!state || !actions) throw new Error('useStore must be used within StoreProvider');
  return { state, actions };
}

/** Returns only actions (stable reference, never triggers re-render). */
export function useActions(): StoreActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useActions must be used within StoreProvider');
  return actions;
}

/** Returns only state. Components using this re-render on state changes. */
export function useStoreState(): AppState {
  const state = useContext(StateContext);
  if (!state) throw new Error('useStoreState must be used within StoreProvider');
  return state;
}
