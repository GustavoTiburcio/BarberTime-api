import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from '../lib/db';
import { withCors } from './_utils/cors';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (withCors(req, res)) return;

  if (req.method === 'GET') {
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

      return res.status(200).json(professionals);
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
      res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
  }

  if (req.method === 'POST') {

    const {
      name,
      avatar,
      specialties,
      rating,
    } = req.body;

    if (
      !name ||
      !avatar ||
      !specialties ||
      !rating
    ) {
      return res.status(400).json({ error: 'Dados obrigatórios não informados' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 3️⃣ Inserir profissional
      const insertResult = await client.query(
        `
        INSERT INTO professionals
          (name, avatar, specialties, rating, active)
        VALUES
          ($1, $2, $3, $4, $5)
        RETURNING id, name, avatar, specialties, rating, active
        `,
        [
          name,
          avatar,
          specialties,
          rating,
          true,
        ]
      );

      await client.query('COMMIT');

      return res.status(201).json(insertResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ error: 'Erro ao criar agendamento' });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });

}
