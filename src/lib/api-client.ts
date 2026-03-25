/**
 * Typed API client for the Folly Content Engine database layer.
 * All methods return parsed JSON responses.
 */

const BASE = '/api/db';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string | number] => pair[1] !== undefined,
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ── Studies ─────────────────────────────────────────────────────────────────

interface StudyRow {
  paper_id: string;
  title: string;
  abstract: string;
  year: number | null;
  citation_count: number;
  authors: string;
  journal: string | null;
  doi: string | null;
  url: string;
  pdf_url: string | null;
  tldr: string | null;
  segments: string[];
  created_at: string;
  updated_at: string;
}

interface StudiesListResponse {
  studies: StudyRow[];
  count: number;
}

interface StudiesRefreshResponse {
  inserted: number;
  updated: number;
  total: number;
  segment: string;
}

// ── Runs ────────────────────────────────────────────────────────────────────

interface RunRow {
  id: string;
  label: string;
  month: number;
  year: number;
  created_at: string;
}

interface RunsListResponse {
  runs: RunRow[];
}

interface RunGetResponse {
  run: RunRow;
}

interface RunCreateResponse {
  run: RunRow;
}

// ── Topics ──────────────────────────────────────────────────────────────────

interface TopicRow {
  id: string;
  run_id: string;
  segment: string;
  headline: string;
  source_question: string;
  emotion: string;
  folly_hook: string;
  suggested_subject_line: string;
  freshness: string;
  selected: boolean;
  created_at: string;
  updated_at: string;
}

interface TopicsListResponse {
  topics: TopicRow[];
}

interface TopicsCreateResponse {
  topics: TopicRow[];
  count: number;
}

interface TopicUpdateResponse {
  topic: TopicRow;
}

// ── Packages ────────────────────────────────────────────────────────────────

interface PackageRow {
  id: string;
  run_id: string;
  topic_id: string;
  segment: string;
  source_question: string;
  emotion: string;
  folly_hook: string;
  headline: string;
  meta_title: string;
  meta_description: string;
  blog_body: string;
  blog_tags: string[];
  word_count: number;
  subject_line: string;
  preview_text: string;
  email_body: string;
  cta_text: string;
  blog_image_url: string | null;
  email_image_url: string | null;
  blog_image_status: string;
  email_image_status: string;
  status: string;
  compliance_flags: unknown[];
  generated_by: string;
  created_at: string;
  updated_at: string;
}

interface PackagesListResponse {
  packages: PackageRow[];
}

interface PackageGetResponse {
  package: PackageRow;
}

interface PackagesCreateResponse {
  packages: PackageRow[];
  count: number;
}

interface PackageUpdateResponse {
  package: PackageRow;
}

// ── Receipts ────────────────────────────────────────────────────────────────

interface ReceiptRow {
  id: string;
  run_id: string;
  package_id: string;
  segment: string;
  channel: string;
  platform_id: string | null;
  platform_url: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ReceiptsListResponse {
  receipts: ReceiptRow[];
}

interface ReceiptsCreateResponse {
  receipts: ReceiptRow[];
  count: number;
}

// ── API Client ──────────────────────────────────────────────────────────────

export const api = {
  studies: {
    list(segment: string, limit?: number, offset?: number) {
      return request<StudiesListResponse>(`/studies${qs({ segment, limit, offset })}`);
    },
    refresh(segment: string) {
      return request<StudiesRefreshResponse>('/studies/refresh', {
        method: 'POST',
        body: JSON.stringify({ segment }),
      });
    },
    bulkUpsert(studies: Record<string, unknown>[]) {
      return request<{ inserted: number; updated: number; total: number }>('/studies', {
        method: 'POST',
        body: JSON.stringify({ studies }),
      });
    },
  },

  runs: {
    list() {
      return request<RunsListResponse>('/runs');
    },
    get(id: string) {
      return request<RunGetResponse>(`/runs${qs({ id })}`);
    },
    create(data: { id: string; label: string; month: number; year: number }) {
      return request<RunCreateResponse>('/runs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  topics: {
    list(runId: string, segment?: string) {
      return request<TopicsListResponse>(`/topics${qs({ run_id: runId, segment })}`);
    },
    bulkCreate(topics: Record<string, unknown>[]) {
      return request<TopicsCreateResponse>('/topics', {
        method: 'POST',
        body: JSON.stringify({ topics }),
      });
    },
    update(id: string, updates: Record<string, unknown>) {
      return request<TopicUpdateResponse>('/topics', {
        method: 'PATCH',
        body: JSON.stringify({ id, updates }),
      });
    },
  },

  packages: {
    list(runId: string, segment?: string) {
      return request<PackagesListResponse>(`/packages${qs({ run_id: runId, segment })}`);
    },
    get(id: string) {
      return request<PackageGetResponse>(`/packages${qs({ id })}`);
    },
    bulkCreate(packages: Record<string, unknown>[]) {
      return request<PackagesCreateResponse>('/packages', {
        method: 'POST',
        body: JSON.stringify({ packages }),
      });
    },
    update(id: string, updates: Record<string, unknown>) {
      return request<PackageUpdateResponse>('/packages', {
        method: 'PATCH',
        body: JSON.stringify({ id, updates }),
      });
    },
  },

  receipts: {
    list(runId: string, segment?: string) {
      return request<ReceiptsListResponse>(`/receipts${qs({ run_id: runId, segment })}`);
    },
    bulkCreate(receipts: Record<string, unknown>[]) {
      return request<ReceiptsCreateResponse>('/receipts', {
        method: 'POST',
        body: JSON.stringify({ receipts }),
      });
    },
  },
};

export type {
  StudyRow,
  RunRow,
  TopicRow,
  PackageRow,
  ReceiptRow,
  StudiesListResponse,
  StudiesRefreshResponse,
  RunsListResponse,
  RunGetResponse,
  RunCreateResponse,
  TopicsListResponse,
  TopicsCreateResponse,
  TopicUpdateResponse,
  PackagesListResponse,
  PackageGetResponse,
  PackagesCreateResponse,
  PackageUpdateResponse,
  ReceiptsListResponse,
  ReceiptsCreateResponse,
};
