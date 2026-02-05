import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({ ok: true, time: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Erro ao conectar no banco' });
  }
}
