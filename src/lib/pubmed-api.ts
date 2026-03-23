export interface PubMedResult {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi: string;
}

/**
 * Search PubMed via the /api/research serverless function.
 */
export async function searchPubMed(
  query: string,
  maxResults: number = 5,
): Promise<PubMedResult[]> {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `PubMed search failed: ${res.status}`);
  }

  const data = await res.json();
  return (data.results ?? []) as PubMedResult[];
}

// ---------------------------------------------------------------------------
// Segment-aware PubMed query builder
// ---------------------------------------------------------------------------

/** Medical terminology mappings per segment for constructing effective PubMed queries. */
const SEGMENT_TERMS: Record<string, { base: string[]; keywords: Record<string, string[]> }> = {
  glp1: {
    base: ['"hair loss"'],
    keywords: {
      semaglutide: ['"GLP-1 receptor agonist"', '"semaglutide"'],
      tirzepatide: ['"GLP-1 receptor agonist"', '"tirzepatide"'],
      ozempic: ['"GLP-1 receptor agonist"', '"semaglutide"'],
      mounjaro: ['"GLP-1 receptor agonist"', '"tirzepatide"'],
      nutrient: ['"nutritional deficiency"', '"weight loss"'],
      deficiency: ['"nutritional deficiency"', '"rapid weight loss"'],
      shedding: ['"telogen effluvium"', '"GLP-1"'],
      thinning: ['"GLP-1 receptor agonist"', '"alopecia"'],
      'weight loss': ['"rapid weight loss"', '"telogen effluvium"'],
      protein: ['"protein deficiency"', '"hair loss"'],
      biotin: ['"biotin"', '"GLP-1"', '"hair"'],
    },
  },
  postpartum: {
    base: ['"postpartum"', '"hair loss"'],
    keywords: {
      shedding: ['"telogen effluvium"', '"postpartum"'],
      breastfeeding: ['"lactation"', '"hair loss"'],
      regrowth: ['"postpartum"', '"hair regrowth"'],
      vitamins: ['"dietary supplements"', '"postpartum"', '"hair"'],
      iron: ['"iron deficiency"', '"postpartum"', '"alopecia"'],
      hormones: ['"postpartum"', '"hormonal"', '"alopecia"'],
      timeline: ['"postpartum"', '"telogen effluvium"', '"duration"'],
      normal: ['"postpartum alopecia"', '"prevalence"'],
    },
  },
  perimeno: {
    base: ['"hair loss"'],
    keywords: {
      perimenopause: ['"perimenopause"', '"alopecia"'],
      menopause: ['"menopause"', '"female pattern hair loss"'],
      hormone: ['"hormonal"', '"androgenetic alopecia"', '"women"'],
      hrt: ['"hormone replacement therapy"', '"hair"'],
      estrogen: ['"estrogen"', '"hair follicle"'],
      pcos: ['"polycystic ovary syndrome"', '"alopecia"'],
      thyroid: ['"thyroid"', '"hair loss"', '"women"'],
      androgen: ['"androgen"', '"female pattern hair loss"'],
      thinning: ['"perimenopause"', '"hair thinning"'],
      spironolactone: ['"spironolactone"', '"hair loss"', '"women"'],
    },
  },
  pillfatigue: {
    base: ['"hair loss"'],
    keywords: {
      biotin: ['"biotin"', '"hair loss"', '"efficacy"'],
      nutrafol: ['"dietary supplements"', '"hair loss"', '"clinical trial"'],
      viviscal: ['"dietary supplements"', '"hair growth"', '"marine protein"'],
      collagen: ['"collagen"', '"hair"', '"supplementation"'],
      supplement: ['"dietary supplements"', '"hair loss"', '"efficacy"'],
      pills: ['"oral supplementation"', '"hair growth"', '"women"'],
      topical: ['"topical"', '"hair growth"', '"minoxidil"'],
      'side effects': ['"hair supplements"', '"adverse effects"'],
      'not working': ['"dietary supplements"', '"hair loss"', '"treatment outcome"'],
      alternatives: ['"hair loss treatment"', '"women"', '"comparative"'],
    },
  },
};

const DEFAULT_BASE = ['"hair loss"', '"women"'];

/**
 * Build an effective PubMed search query from a segment ID and a topic headline.
 *
 * Combines segment-specific medical terminology with keywords extracted from the
 * headline to produce a query that returns clinically relevant results.
 *
 * @example
 * buildPubMedQuery('glp1', 'hair thinning month 3')
 * // '"GLP-1 receptor agonist" AND "hair loss" AND "alopecia"'
 *
 * buildPubMedQuery('postpartum', 'when does shedding stop')
 * // '"telogen effluvium" AND "postpartum" AND "hair loss"'
 */
export function buildPubMedQuery(segmentId: string, topicHeadline: string): string {
  const segConfig = SEGMENT_TERMS[segmentId];
  const headline = topicHeadline.toLowerCase();

  // Collect all unique terms
  const terms = new Set<string>();

  // Add base terms for this segment
  const baseParts = segConfig?.base ?? DEFAULT_BASE;
  for (const t of baseParts) {
    terms.add(t);
  }

  if (segConfig) {
    // Match headline words against keyword mappings
    let matched = false;
    for (const [keyword, medTerms] of Object.entries(segConfig.keywords)) {
      if (headline.includes(keyword)) {
        for (const t of medTerms) {
          terms.add(t);
        }
        matched = true;
      }
    }

    // If nothing matched, add segment-level defaults
    if (!matched) {
      // Use the first keyword entry's terms as a fallback
      const firstEntry = Object.values(segConfig.keywords)[0];
      if (firstEntry) {
        for (const t of firstEntry) {
          terms.add(t);
        }
      }
    }
  }

  return Array.from(terms).join(' AND ');
}
