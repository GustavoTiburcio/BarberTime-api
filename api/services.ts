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
        description,
        duration,
        price
      FROM services
      WHERE active = true
      ORDER BY name
    `);

      const services = result.rows.map(s => ({
        ...s,
        duration: Number(s.duration),
        price: Number(s.price),
      }));

      return res.status(200).json(services);
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
      res.status(500).json({ error: 'Erro ao buscar serviços' });
    }
  }

  if (req.method === 'POST') {
    const {
      name,
      description,
      duration,
      price,
    } = req.body;

    if (!name || !description || duration == null || price == null) {
      return res.status(400).json({ error: 'Dados obrigatórios não informados' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const insertResult = await client.query(
        `
        INSERT INTO services
          (name, description, duration, price, active)
        VALUES
          ($1, $2, $3, $4, $5)
        RETURNING id, name, description, duration, price, active
        `,
        [
          name,
          description,
          duration,
          price,
          true,
        ]
      );

      await client.query('COMMIT');

      return res.status(201).json(insertResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ error: 'Erro ao criar serviço' });
    } finally {
      client.release();
    }
  }

  if (req.method === 'PUT') {
    const { name, description, duration, price } = req.body;
    const { id } = req.query;

    if (!id || !name || !description || duration == null || price == null) {
      return res.status(400).json({ error: 'Dados obrigatórios não informados' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updateResult = await client.query(
        `
        UPDATE services
        SET
          name = $2,
          description = $3,
          duration = $4,
          price = $5
        WHERE id = $1
        RETURNING id, name, description, duration, price
        `,
        [
          id,
          name,
          description,
          duration,
          price,
        ]
      );

      await client.query('COMMIT');

      return res.status(200).json(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ error: 'Erro ao atualizar serviço' });
    } finally {
      client.release();
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID do serviço não informado' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const deleteResult = await client.query(
        `
        UPDATE services
        SET active = false
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      await client.query('COMMIT');

      return res.status(200).json(deleteResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ error: 'Erro ao desativar serviço' });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
