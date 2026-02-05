import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (withCors(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        avatar,
        specialties,
        rating
      FROM professionals
      WHERE active = true
      ORDER BY rating DESC, name
    `);

    const professionals = result.rows.map(p => ({
      ...p,
      rating: Number(p.rating),
    }));

    res.status(200).json(professionals);
  } catch (error) {
    console.error('Erro ao buscar profissionais:', error);
    res.status(500).json({ error: 'Erro ao buscar profissionais' });
  }
}
