import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        duration,
        price
      FROM services
      WHERE active = true
      ORDER BY name
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
}
