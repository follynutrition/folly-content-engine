import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { run_id, segment, id } = req.query;

      // Single package by ID
      if (id && typeof id === 'string') {
        const { rows } = await sql`SELECT * FROM content_packages WHERE id = ${id}`;
        if (rows.length === 0) {
          return res.status(404).json({ error: `Package not found: ${id}` });
        }
        return res.status(200).json({ package: rows[0] });
      }

      if (!run_id || typeof run_id !== 'string') {
        return res.status(400).json({ error: 'run_id or id query param is required' });
      }

      if (segment && typeof segment === 'string') {
        const { rows } = await sql`
          SELECT * FROM content_packages
          WHERE run_id = ${run_id} AND segment = ${segment}
          ORDER BY created_at ASC
        `;
        return res.status(200).json({ packages: rows });
      }

      const { rows } = await sql`
        SELECT * FROM content_packages
        WHERE run_id = ${run_id}
        ORDER BY created_at ASC
      `;
      return res.status(200).json({ packages: rows });
    }

    if (req.method === 'POST') {
      const { packages } = req.body;

      if (!Array.isArray(packages) || packages.length === 0) {
        return res.status(400).json({ error: 'Request body must include a non-empty packages array' });
      }

      const inserted = [];
      for (const p of packages) {
        const { rows } = await sql`
          INSERT INTO content_packages (
            id, run_id, topic_id, segment, source_question, emotion, folly_hook,
            headline, meta_title, meta_description, blog_body, blog_tags, word_count,
            subject_line, preview_text, email_body, cta_text,
            blog_image_url, email_image_url, blog_image_status, email_image_status,
            status, compliance_flags, generated_by
          ) VALUES (
            ${p.id}, ${p.run_id}, ${p.topic_id}, ${p.segment},
            ${p.source_question}, ${p.emotion}, ${p.folly_hook},
            ${p.headline}, ${p.meta_title}, ${p.meta_description},
            ${p.blog_body}, ${p.blog_tags}::text[], ${p.word_count},
            ${p.subject_line}, ${p.preview_text}, ${p.email_body}, ${p.cta_text},
            ${p.blog_image_url ?? null}, ${p.email_image_url ?? null},
            ${p.blog_image_status ?? 'pending'}, ${p.email_image_status ?? 'pending'},
            ${p.status ?? 'pending'},
            ${JSON.stringify(p.compliance_flags ?? [])}::jsonb,
            ${p.generated_by ?? 'claude'}
          )
          RETURNING *
        `;
        inserted.push(rows[0]);
      }

      return res.status(201).json({ packages: inserted, count: inserted.length });
    }

    if (req.method === 'PATCH') {
      const { id, updates } = req.body;

      if (!id || !updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'id and updates object are required' });
      }

      const allowedFields = [
        'headline', 'meta_title', 'meta_description', 'blog_body', 'blog_tags',
        'word_count', 'subject_line', 'preview_text', 'email_body', 'cta_text',
        'blog_image_url', 'email_image_url', 'blog_image_status', 'email_image_status',
        'status', 'compliance_flags', 'source_question', 'emotion', 'folly_hook',
        'generated_by',
      ];

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (key === 'compliance_flags') {
            setClauses.push(`${key} = $${paramIndex}::jsonb`);
            values.push(JSON.stringify(value));
          } else if (key === 'blog_tags') {
            setClauses.push(`${key} = $${paramIndex}::text[]`);
            values.push(value);
          } else {
            setClauses.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE content_packages SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const { rows } = await sql.query(query, values);

      if (rows.length === 0) {
        return res.status(404).json({ error: `Package not found: ${id}` });
      }

      return res.status(200).json({ package: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Packages API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
