import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';

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
        rating,
        username
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
      avatar,
      name,
      password,
      rating,
      specialties,
      username
    } = req.body;

    if (
      !name ||
      !avatar ||
      !specialties ||
      !rating ||
      !password ||
      !username
    ) {
      return res.status(400).json({ error: 'Dados obrigatórios não informados' });
    }

    const client = await pool.connect();

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      await client.query('BEGIN');

      // 3️⃣ Inserir profissional
      const insertResult = await client.query(
        `
        INSERT INTO professionals
          (name, avatar, specialties, rating, password_hash, username, active)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, avatar, specialties, rating, active, username
        `,
        [
          name,
          avatar,
          specialties,
          rating,
          passwordHash,
          username,
          true,
        ]
      );

      await client.query('COMMIT');

      return res.status(201).json(insertResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      if (error && (error as any).code === '23505') {
        return res.status(409).json({ error: 'Nome de usuário já existe' });
      }
      return res.status(500).json({ error: 'Erro ao criar profissional' });
    } finally {
      client.release();
    }
  }

  if (req.method === 'PUT') {
    const { name, avatar, specialties, rating, username, password } = req.body;
    const { id } = req.query;

    if (!id || !name || !avatar || !specialties || !rating || !username) {
      return res.status(400).json({ error: 'Dados obrigatórios não informados' });
    }

    const client = await pool.connect();

    try {
      let passwordHash;
      if (password) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      await client.query('BEGIN');

      const updateResult = await client.query(
        `
        UPDATE professionals
        SET
          name = $2,
          avatar = $3,
          specialties = $4,
          rating = $5,
          username = $6
          ${passwordHash ? ', password_hash = $7' : ''}
        WHERE id = $1
        RETURNING id, name, avatar, specialties, rating, role, username
        `,
        [
          id,
          name,
          avatar,
          specialties,
          rating,
          username,
          ...(passwordHash ? [passwordHash] : [])
        ]
      );

      await client.query('COMMIT');

      return res.status(200).json(updateResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ error: 'Erro ao atualizar profissional' });
    } finally {
      client.release();
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID do profissional não informado' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const deleteResult = await client.query(
        `
        UPDATE professionals
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
      return res.status(500).json({ error: 'Erro ao desativar profissional' });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });

}
