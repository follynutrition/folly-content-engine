-- Folly Content Engine — Initial Schema
-- Run against Neon/Vercel Postgres

-- Permanent study library (grows over time)
CREATE TABLE IF NOT EXISTS studies (
  id              SERIAL PRIMARY KEY,
  paper_id        TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  abstract        TEXT,
  tldr            TEXT,
  year            INTEGER,
  citation_count  INTEGER DEFAULT 0,
  authors         TEXT,
  journal         TEXT,
  doi             TEXT,
  url             TEXT,
  pdf_url         TEXT,
  segments        TEXT[] DEFAULT '{}',
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_studies_segments ON studies USING GIN (segments);
CREATE INDEX IF NOT EXISTS idx_studies_citations ON studies (citation_count DESC);

-- Monthly content runs
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  month       INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Topic briefs per run
CREATE TABLE IF NOT EXISTS topics (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id                 TEXT REFERENCES runs(id) ON DELETE CASCADE,
  segment                TEXT NOT NULL,
  headline               TEXT NOT NULL,
  source_question        TEXT,
  emotion                TEXT,
  folly_hook             TEXT,
  suggested_subject_line TEXT,
  selected               BOOLEAN DEFAULT true,
  linked_study_ids       INTEGER[] DEFAULT '{}',
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topics_run_segment ON topics (run_id, segment);

-- Generated content packages
CREATE TABLE IF NOT EXISTS content_packages (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic_id            TEXT REFERENCES topics(id) ON DELETE CASCADE,
  run_id              TEXT REFERENCES runs(id) ON DELETE CASCADE,
  segment             TEXT NOT NULL,
  headline            TEXT,
  meta_title          TEXT,
  meta_description    TEXT,
  blog_body           TEXT,
  blog_tags           TEXT[] DEFAULT '{}',
  word_count          INTEGER DEFAULT 0,
  subject_line        TEXT,
  preview_text        TEXT,
  email_body          TEXT,
  cta_text            TEXT,
  blog_image_url      TEXT,
  email_image_url     TEXT,
  blog_image_status   TEXT DEFAULT 'pending',
  email_image_status  TEXT DEFAULT 'pending',
  status              TEXT DEFAULT 'pending',
  compliance_flags    JSONB DEFAULT '[]',
  generated_by        TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_packages_run_segment ON content_packages (run_id, segment);
CREATE INDEX IF NOT EXISTS idx_packages_status ON content_packages (run_id, status);

-- Publish receipts
CREATE TABLE IF NOT EXISTS publish_receipts (
  id              SERIAL PRIMARY KEY,
  run_id          TEXT REFERENCES runs(id) ON DELETE CASCADE,
  package_id      TEXT REFERENCES content_packages(id),
  segment         TEXT NOT NULL,
  blog_url        TEXT,
  blog_status     TEXT,
  klaviyo_id      TEXT,
  send_date       TEXT,
  campaign_status TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipts_run ON publish_receipts (run_id, segment);
