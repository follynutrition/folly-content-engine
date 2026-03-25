import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { run_id, segment } = req.query;

      if (!run_id || typeof run_id !== 'string') {
        return res.status(400).json({ error: 'run_id query param is required' });
      }

      if (segment && typeof segment === 'string') {
        const { rows } = await sql`
          SELECT * FROM topics
          WHERE run_id = ${run_id} AND segment = ${segment}
          ORDER BY created_at ASC
        `;
        return res.status(200).json({ topics: rows });
      }

      const { rows } = await sql`
        SELECT * FROM topics
        WHERE run_id = ${run_id}
        ORDER BY created_at ASC
      `;
      return res.status(200).json({ topics: rows });
    }

    if (req.method === 'POST') {
      const { topics } = req.body;

      if (!Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({ error: 'Request body must include a non-empty topics array' });
      }

      const inserted = [];
      for (const t of topics) {
        const { rows } = await sql`
          INSERT INTO topics (
            id, run_id, segment, headline, source_question,
            emotion, folly_hook, suggested_subject_line,
            freshness, selected
          ) VALUES (
            ${t.id}, ${t.run_id}, ${t.segment}, ${t.headline}, ${t.source_question},
            ${t.emotion}, ${t.folly_hook}, ${t.suggested_subject_line},
            ${t.freshness ?? 'evergreen'}, ${t.selected ?? true}
          )
          RETURNING *
        `;
        inserted.push(rows[0]);
      }

      return res.status(201).json({ topics: inserted, count: inserted.length });
    }

    if (req.method === 'PATCH') {
      const { id, updates } = req.body;

      if (!id || !updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'id and updates object are required' });
      }

      // Build dynamic SET clause from updates
      const allowedFields = [
        'headline', 'source_question', 'emotion', 'folly_hook',
        'suggested_subject_line', 'freshness', 'selected', 'segment',
      ];

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE topics SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const { rows } = await sql.query(query, values);

      if (rows.length === 0) {
        return res.status(404).json({ error: `Topic not found: ${id}` });
      }

      return res.status(200).json({ topic: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Topics API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
