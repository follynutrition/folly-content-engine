import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PubMedSearchResult {
  esearchresult: {
    idlist: string[];
    count: string;
  };
}

interface PubMedAuthor {
  name: string;
  authtype: string;
}

interface PubMedArticle {
  uid: string;
  title: string;
  authors: PubMedAuthor[];
  source: string;
  pubdate: string;
  elocationid: string;
  sortfirstauthor: string;
}

interface PubMedSummaryResult {
  result: Record<string, PubMedArticle> & { uids: string[] };
}

const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const NCBI_PARAMS = 'tool=folly-content-engine&email=team@follynutrition.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, maxResults = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid query' });
    }

    const clampedMax = Math.min(Math.max(1, maxResults), 20);

    // Step 1: Search PubMed for PMIDs
    const searchUrl = `${NCBI_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${clampedMax}&retmode=json&sort=relevance&${NCBI_PARAMS}`;
    const searchRes = await fetch(searchUrl);

    if (!searchRes.ok) {
      return res.status(502).json({ error: `PubMed search failed: ${searchRes.status}` });
    }

    const searchData = (await searchRes.json()) as PubMedSearchResult;
    const pmids = searchData.esearchresult?.idlist ?? [];

    if (pmids.length === 0) {
      return res.status(200).json({ results: [] });
    }

    // Step 2: Fetch summaries for each PMID
    const summaryUrl = `${NCBI_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json&${NCBI_PARAMS}`;
    const summaryRes = await fetch(summaryUrl);

    if (!summaryRes.ok) {
      return res.status(502).json({ error: `PubMed summary failed: ${summaryRes.status}` });
    }

    const summaryData = (await summaryRes.json()) as PubMedSummaryResult;

    const results = pmids.map((pmid) => {
      const article = summaryData.result[pmid];
      if (!article) return null;

      // Extract DOI from elocationid (format: "doi: 10.xxxx/yyyy")
      const doiMatch = article.elocationid?.match(/doi:\s*(.+)/i);
      const doi = doiMatch ? doiMatch[1].trim() : '';

      // Format authors: "LastName AB, LastName CD, ..."
      const authors = (article.authors ?? [])
        .map((a) => a.name)
        .join(', ');

      // Extract year from pubdate (e.g. "2024 Jan 15" -> "2024")
      const yearMatch = article.pubdate?.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : '';

      return {
        pmid,
        title: article.title ?? '',
        authors,
        journal: article.source ?? '',
        year,
        doi,
        abstract_snippet: '', // esummary doesn't return abstracts; would need efetch for that
      };
    }).filter(Boolean);

    return res.status(200).json({ results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('PubMed API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
