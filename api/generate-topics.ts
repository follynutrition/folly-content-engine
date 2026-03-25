import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Segment config — duplicated here since serverless functions can't import from src/
const SEGMENT_QUERIES: Record<string, string[]> = {
  glp1: [
    'GLP-1 receptor agonist semaglutide tirzepatide hair loss alopecia telogen effluvium',
    'rapid weight loss nutritional deficiency hair shedding micronutrient',
  ],
  postpartum: [
    'postpartum telogen effluvium hair loss hormonal recovery women',
    'lactation breastfeeding iron deficiency micronutrient depletion maternal',
  ],
  perimeno: [
    'perimenopause menopause hormonal hair loss thinning women estrogen',
    'thyroid PCOS androgenetic alopecia female pattern hair loss',
  ],
  pillfatigue: [
    'hair supplement efficacy biotin clinical trial women',
    'supplement bioavailability absorption delivery system micronutrient',
  ],
};

const SEGMENT_CONTEXT: Record<string, string> = {
  glp1: 'Women experiencing hair loss/shedding from GLP-1 medications (semaglutide, tirzepatide, Ozempic, Mounjaro). They are scared, confused, and often their doctors dismiss it.',
  postpartum: 'Women experiencing hair loss after pregnancy, during breastfeeding, or in the first year postpartum. They feel blindsided because nobody warned them.',
  perimeno: 'Women experiencing hair thinning due to perimenopause, menopause, hormonal changes, PCOS, or thyroid issues. They feel invisible and frustrated.',
  pillfatigue: 'Women who have tried other hair supplements (Nutrafol, Viviscal, biotin) and are frustrated with results, tired of pills, or looking for something that actually works.',
};

const S2_BASE = 'https://api.semanticscholar.org/graph/v1';
const S2_FIELDS = 'title,abstract,year,citationCount,influentialCitationCount,url,authors,journal,tldr,externalIds';

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  citationCount: number;
  influentialCitationCount: number;
  url: string;
  authors: { name: string }[];
  journal: { name: string } | null;
  tldr: { text: string } | null;
  externalIds: { DOI?: string } | null;
}

interface S2SearchResponse {
  total: number;
  data: S2Paper[];
}

interface GeneratedTopic {
  headline: string;
  suggested_subject_line: string;
  preview_text: string;
  email_body_draft: string;
  cta_text: string;
  emotion: string;
  folly_hook: string;
  linked_study_ids: number[];
  rationale: string;
}

async function fetchStudies(segment: string): Promise<S2Paper[]> {
  const queries = SEGMENT_QUERIES[segment] ?? [];
  const allPapers: S2Paper[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    try {
      const url = `${S2_BASE}/paper/search?query=${encodeURIComponent(query)}&limit=20&fields=${S2_FIELDS}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as S2SearchResponse;
      for (const paper of data.data ?? []) {
        if (!seenIds.has(paper.paperId) && paper.title && paper.abstract) {
          seenIds.add(paper.paperId);
          allPapers.push(paper);
        }
      }
    } catch {
      // Skip failed queries
    }
  }

  // Sort by citation count descending, take top 30
  allPapers.sort((a, b) => b.citationCount - a.citationCount);
  return allPapers.slice(0, 30);
}

async function fetchAutocomplete(segment: string): Promise<string[]> {
  const seedQueries: Record<string, string[]> = {
    glp1: ['GLP-1 hair loss', 'semaglutide hair loss', 'Ozempic hair loss'],
    postpartum: ['postpartum hair loss', 'breastfeeding hair loss', 'postpartum shedding'],
    perimeno: ['menopause hair thinning', 'perimenopause hair loss', 'hormone hair loss women'],
    pillfatigue: ['Nutrafol alternatives', 'best hair supplements women', 'hair supplement not working'],
  };

  const queries = seedQueries[segment] ?? [];
  if (queries.length === 0) return [];

  const allSuggestions: string[] = [];
  const seen = new Set<string>();

  // Fetch a few suggestions directly (keep it fast)
  for (const query of queries.slice(0, 3)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as [string, string[]];
      for (const s of data[1] ?? []) {
        const normalized = s.trim().toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          allSuggestions.push(s.trim());
        }
      }
    } catch {
      // Skip failed queries
    }
  }

  return allSuggestions.slice(0, 40);
}

function buildPrompt(
  studies: S2Paper[],
  autocomplete: string[],
  segment: string,
  count: number,
): { system: string; user: string } {
  const segmentContext = SEGMENT_CONTEXT[segment] ?? segment;

  const studySummaries = studies.map((s, i) => {
    const tldr = s.tldr?.text ? ` — TLDR: ${s.tldr.text}` : '';
    const abstract = s.abstract ? s.abstract.substring(0, 200) + '...' : '';
    return `[Study ${i + 1}] "${s.title}" (${s.journal?.name ?? 'Unknown'}, ${s.year ?? 'n.d.'}) — ${s.citationCount} citations${tldr}\n  Abstract: ${abstract}`;
  }).join('\n\n');

  const autocompleteSummary = autocomplete.length > 0
    ? `TOP GOOGLE AUTOCOMPLETE SEARCHES (what real people are typing):\n${autocomplete.map(s => `- "${s}"`).join('\n')}`
    : '';

  const system = `You are Luna Yu, co-founder and chief scientist at Folly Nutrition. Biotech background, Forbes 30 Under 30. You created Folly because you experienced female pattern hair loss yourself.

You are generating topic briefs for email marketing campaigns. Each topic should be a fully-formed email concept that will hook the target audience and drive them to read a blog post.

YOUR VOICE: Scientist-founder. Confident, knowledgeable, never condescending. Empathetic — you GET what this person is going through. Direct, warm, real.

CRITICAL RULES:
- Each topic MUST reference at least 1 specific study finding from the provided studies
- Headlines should be provocative and emotional, NOT keyword-stuffed SEO bait
- Subject lines must tease without giving the payoff (max 50 chars)
- Preview text deepens curiosity (max 90 chars)
- Email body draft is 2-3 sentences, max 50 words — a teaser, not the full email
- Topics should cover DIFFERENT angles — don't repeat similar themes
- Topics don't have to be about hair loss specifically. They can be broadly educational about the segment's concerns, with Folly as the publisher (not always the subject)
- Emotion tags: scared, confused, anxious, frustrated, angry, worried, desperate, panicked, hopeful, seeking
- Folly hooks should mention specific Folly science (microsphere delivery, biotin+iron complex, 1675mg actives, etc.)
- Rationale: 1 sentence explaining why this topic will convert for this audience

COMPLIANCE:
- "Hair health" not "hair regrowth" or "hair loss treatment"
- "Clinically Studied" not "Clinically Proven"
- "Supports" not "treats/cures/reverses/prevents"
- No drug dosages or medical diagnoses
- No urgency language`;

  const user = `Generate exactly ${count} topic briefs for the following segment.

SEGMENT: ${segment}
CONTEXT: ${segmentContext}

${studySummaries ? `RESEARCH STUDIES:\n${studySummaries}` : 'No studies available — generate topics based on general knowledge.'}

${autocompleteSummary}

Return ONLY a JSON array of ${count} objects, no other text. Each object must have these exact fields:
{
  "headline": "...",
  "suggested_subject_line": "... (max 50 chars)",
  "preview_text": "... (max 90 chars)",
  "email_body_draft": "... (2-3 sentences, max 50 words)",
  "cta_text": "...",
  "emotion": "scared|confused|anxious|frustrated|angry|worried|desperate|panicked|hopeful|seeking",
  "folly_hook": "...",
  "linked_study_ids": [array of study numbers from the list above],
  "rationale": "1 sentence"
}`;

  return { system, user };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { segment, count = 10 } = req.body;

    if (!segment || typeof segment !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid segment' });
    }

    const clampedCount = Math.min(Math.max(1, count), 15);

    // Fetch studies and autocomplete in parallel
    const [studies, autocomplete] = await Promise.all([
      fetchStudies(segment),
      fetchAutocomplete(segment),
    ]);

    // Build prompt
    const { system, user } = buildPrompt(studies, autocomplete, segment, clampedCount);

    // Call Claude
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.8,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return res.status(500).json({ error: 'No text response from Claude' });
    }

    // Parse JSON — handle potential markdown code blocks
    let rawText = textBlock.text.trim();
    // Strip markdown code fences if present
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      rawText = jsonMatch[1].trim();
    }
    // Try to find a JSON array
    const arrayMatch = rawText.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return res.status(500).json({ error: 'Failed to parse topics from Claude response', raw: rawText.substring(0, 500) });
    }

    let topics: GeneratedTopic[];
    try {
      topics = JSON.parse(arrayMatch[0]);
    } catch (parseErr) {
      return res.status(500).json({
        error: 'JSON parse error in Claude response',
        raw: arrayMatch[0].substring(0, 500),
      });
    }

    // Validate and normalize each topic
    const validTopics = topics
      .filter(t => t.headline && t.suggested_subject_line)
      .map(t => ({
        headline: String(t.headline),
        suggested_subject_line: String(t.suggested_subject_line).substring(0, 50),
        preview_text: String(t.preview_text ?? '').substring(0, 90),
        email_body_draft: String(t.email_body_draft ?? ''),
        cta_text: String(t.cta_text ?? 'READ MORE'),
        emotion: t.emotion ?? 'seeking',
        folly_hook: String(t.folly_hook ?? ''),
        linked_study_ids: Array.isArray(t.linked_study_ids) ? t.linked_study_ids : [],
        rationale: String(t.rationale ?? ''),
      }));

    return res.status(200).json({
      topics: validTopics,
      studies_used: studies.length,
      autocomplete_used: autocomplete.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Generate topics error:', msg);
    return res.status(500).json({ error: msg });
  }
}
