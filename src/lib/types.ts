export interface Segment {
  id: string;
  name: string;
  display_name: string;
  color: string;
  description: string;
  klaviyo_segment_id: string;
  alia_survey_value: string;
  reddit_sources: string[];
  google_seed_queries: string[];
  default_send_time: string;
  send_timezone: string;
}

export interface TopicBrief {
  id: string;
  headline: string;
  source_question: string;
  emotion: EmotionTag;
  folly_hook: string;
  suggested_subject_line: string;
  segment: string;
  freshness: 'trending' | 'evergreen' | 'seasonal';
  selected: boolean;
}

export type EmotionTag =
  | 'scared' | 'confused' | 'anxious' | 'frustrated'
  | 'angry' | 'worried' | 'desperate' | 'panicked'
  | 'hopeful' | 'seeking';

export type PackageStatus = 'pending' | 'approved' | 'rejected' | 'needs_edit' | 'published';

export interface ContentPackage {
  id: string;
  topicId: string;
  segment: string;
  sourceQuestion: string;
  emotion: EmotionTag;
  follyHook: string;

  // Blog
  headline: string;
  metaTitle: string;
  metaDescription: string;
  blogBody: string;
  blogTags: string[];
  wordCount: number;

  // Email
  subjectLine: string;
  previewText: string;
  emailBody: string;
  ctaText: string;

  // Images
  blogImageUrl: string | null;
  emailImageUrl: string | null;
  blogImageStatus: ImageQAStatus;
  emailImageStatus: ImageQAStatus;

  // Status
  status: PackageStatus;
  complianceFlags: ComplianceFlag[];
}

export type ImageQAStatus = 'pending' | 'generating' | 'ready' | 'accepted' | 'rejected' | 'regenerating' | 'swapped';

export interface ComplianceFlag {
  id: string;
  severity: 'hard' | 'soft' | 'slop' | 'brand' | 'payoff_leak';
  field: string;
  message: string;
  match?: string;
}

export type PhaseId = 'research' | 'topics' | 'content' | 'images' | 'review' | 'publish';

export const PHASES: { id: PhaseId; label: string; index: number }[] = [
  { id: 'research', label: 'Research', index: 0 },
  { id: 'topics', label: 'Topics', index: 1 },
  { id: 'content', label: 'Content', index: 2 },
  { id: 'images', label: 'Images', index: 3 },
  { id: 'review', label: 'Review', index: 4 },
  { id: 'publish', label: 'Publish', index: 5 },
];

export interface SegmentState {
  phase: number; // 0-6 (6 = complete)
  topics: TopicBrief[];
  packages: ContentPackage[];
  schedule: ScheduleEntry[];
  publishReceipt: PublishReceipt | null;
}

export interface ScheduleEntry {
  packageId: string;
  date: string;
  time: string;
  dayLabel: string;
}

export interface PublishReceipt {
  blogs: { packageId: string; title: string; url: string; status: 'live' | 'failed' }[];
  campaigns: { packageId: string; subject: string; klaviyoId: string; sendDate: string; status: 'scheduled' | 'failed' }[];
}

export interface Run {
  id: string;
  month: number;
  year: number;
  label: string;
  segments: Record<string, SegmentState>;
}

export interface AppState {
  runs: Record<string, Run>;
  activeRunId: string;
}

export interface ResearchResult {
  source: string;
  question: string;
  votes: number | null;
  emotion: EmotionTag;
  trending: boolean;
}
