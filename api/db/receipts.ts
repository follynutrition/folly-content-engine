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
          SELECT * FROM publish_receipts
          WHERE run_id = ${run_id} AND segment = ${segment}
          ORDER BY created_at DESC
        `;
        return res.status(200).json({ receipts: rows });
      }

      const { rows } = await sql`
        SELECT * FROM publish_receipts
        WHERE run_id = ${run_id}
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ receipts: rows });
    }

    if (req.method === 'POST') {
      const { receipts } = req.body;

      if (!Array.isArray(receipts) || receipts.length === 0) {
        return res.status(400).json({ error: 'Request body must include a non-empty receipts array' });
      }

      const inserted = [];
      for (const r of receipts) {
        const { rows } = await sql`
          INSERT INTO publish_receipts (
            id, run_id, package_id, segment, channel, platform_id,
            platform_url, status, metadata
          ) VALUES (
            ${r.id}, ${r.run_id}, ${r.package_id}, ${r.segment},
            ${r.channel}, ${r.platform_id ?? null},
            ${r.platform_url ?? null}, ${r.status ?? 'pending'},
            ${JSON.stringify(r.metadata ?? {})}::jsonb
          )
          RETURNING *
        `;
        inserted.push(rows[0]);
      }

      return res.status(201).json({ receipts: inserted, count: inserted.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Receipts API error:', msg);
    return res.status(500).json({ error: msg });
  }
}
