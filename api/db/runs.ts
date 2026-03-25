import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { id } = req.query;

      if (id && typeof id === 'string') {
        const { rows } = await sql`SELECT * FROM runs WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: `Run not found: ${id}` });
        }
        return res.status(200).json({ run: rows[0] });
      }

      const { rows } = await sql`SELECT * FROM runs ORDER BY created_at DESC`;
      return res.status(200).json({ runs: rows });
    }

    if (req.method === 'POST') {
      const { id, label, month, year } = req.body;

      if (!id || !label || month == null || year == null) {
        return res.status(400).json({ error: 'id, label, month, and year are required' });
      }

      const { rows } = await sql`
        INSERT INTO runs (id, label, month, year)
        VALUES (${id}, ${label}, ${month}, ${year})
        RETURNING *
      `;

      return res.status(201).json({ run: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Runs API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
