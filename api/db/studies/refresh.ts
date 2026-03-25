import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  citationCount: number;
  url: string;
  authors: { name: string }[];
  journal: { name: string } | null;
  tldr: { text: string } | null;
  externalIds: { DOI?: string } | null;
  openAccessPdf: { url: string } | null;
}

interface S2SearchResponse {
  total: number;
  data: S2Paper[];
}

const S2_BASE = 'https://api.semanticscholar.org/graph/v1';
const FIELDS = 'paperId,title,abstract,year,citationCount,authors,journal,externalIds,openAccessPdf,url,tldr';

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
    'perimenopause menopause female pattern hair loss androgen estrogen',
    'hormone replacement therapy PCOS thyroid hair women alopecia',
  ],
  pillfatigue: [
    'hair loss dietary supplement efficacy clinical trial women biotin',
    'nutraceutical hair growth minoxidil alternative systematic review',
  ],
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchS2(query: string, limit: number = 20, retries: number = 3): Promise<S2Paper[]> {
  const url = `${S2_BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${FIELDS}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'FollyContentEngine/1.0 (team@follynutrition.com)',
        ...(process.env.S2_API_KEY ? { 'x-api-key': process.env.S2_API_KEY } : {}),
      },
    });

    if (res.ok) {
      const data = (await res.json()) as S2SearchResponse;
      return data.data ?? [];
    }

    if (res.status === 429 && attempt < retries) {
      const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.log(`S2 rate limited on "${query}", retrying in ${delay}ms...`);
      await sleep(delay);
      continue;
    }

    console.error(`S2 search failed for "${query}": ${res.status}`);
    return [];
  }

  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { segment } = req.body;

    if (!segment || typeof segment !== 'string') {
      return res.status(400).json({ error: 'segment is required in request body' });
    }

    const queries = SEGMENT_QUERIES[segment];
    if (!queries) {
      return res.status(400).json({
        error: `Unknown segment: ${segment}. Valid segments: ${Object.keys(SEGMENT_QUERIES).join(', ')}`,
      });
    }

    const seen = new Set<string>();
    const allPapers: S2Paper[] = [];

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      try {
        const papers = await searchS2(q, 20);
        for (const p of papers) {
          if (!seen.has(p.paperId) && p.abstract) {
            seen.add(p.paperId);
            allPapers.push(p);
          }
        }
      } catch (err) {
        console.error(`S2 query failed: "${q}"`, err);
      }

      // Rate limit: wait 1.5s between requests
      if (i < queries.length - 1) {
        await sleep(1500);
      }
    }

    // Upsert into studies table
    let inserted = 0;
    let updated = 0;

    for (const p of allPapers) {
      const authors = p.authors.map(a => a.name).join(', ');
      const doi = p.externalIds?.DOI ?? null;
      const pdfUrl = p.openAccessPdf?.url ?? null;
      const tldr = p.tldr?.text ?? null;
      const journal = p.journal?.name ?? null;

      const result = await sql`
        INSERT INTO studies (
          paper_id, title, abstract, year, citation_count,
          authors, journal, doi, url, pdf_url, tldr, segments
        ) VALUES (
          ${p.paperId}, ${p.title}, ${p.abstract}, ${p.year}, ${p.citationCount},
          ${authors}, ${journal}, ${doi}, ${p.url}, ${pdfUrl},
          ${tldr}, ARRAY[${segment}]::text[]
        )
        ON CONFLICT (paper_id) DO UPDATE SET
          title = EXCLUDED.title,
          abstract = EXCLUDED.abstract,
          year = EXCLUDED.year,
          citation_count = EXCLUDED.citation_count,
          authors = EXCLUDED.authors,
          journal = EXCLUDED.journal,
          doi = EXCLUDED.doi,
          url = EXCLUDED.url,
          pdf_url = EXCLUDED.pdf_url,
          tldr = EXCLUDED.tldr,
          segments = (
            SELECT ARRAY(SELECT DISTINCT unnest(studies.segments || EXCLUDED.segments))
          ),
          updated_at = NOW()
      `;

      // rowCount = 1 for both insert and update with ON CONFLICT
      if (result.rowCount && result.rowCount > 0) {
        // We'll just count total; distinguishing insert/update requires xmax check
        inserted++;
      }
    }

    updated = allPapers.length - inserted;
    if (updated < 0) updated = 0;

    return res.status(200).json({
      inserted,
      updated,
      total: allPapers.length,
      segment,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Studies refresh error:', msg);
    return res.status(500).json({ error: msg });
  }
}
