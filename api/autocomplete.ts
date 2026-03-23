import type { VercelRequest, VercelResponse } from '@vercel/node';

type GoogleSuggestResponse = [string, string[]];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { queries } = req.body;

    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid queries array' });
    }

    // Limit input to 20 queries to avoid abuse
    const clamped = queries.slice(0, 20).filter((q): q is string => typeof q === 'string' && q.trim().length > 0);

    if (clamped.length === 0) {
      return res.status(400).json({ error: 'No valid query strings provided' });
    }

    const seen = new Set<string>();
    const allSuggestions: string[] = [];

    const results = await Promise.allSettled(
      clamped.map(async (query) => {
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`Google autocomplete failed for "${query}": ${response.status}`);
          return [];
        }

        const data = (await response.json()) as GoogleSuggestResponse;
        return data[1] ?? [];
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const suggestion of result.value) {
          const normalized = suggestion.trim().toLowerCase();
          if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            allSuggestions.push(suggestion.trim());
          }
        }
      }
    }

    // Cap at 30 unique suggestions
    return res.status(200).json({ suggestions: allSuggestions.slice(0, 30) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Autocomplete API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
