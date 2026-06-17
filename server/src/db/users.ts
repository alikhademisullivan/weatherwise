import bcrypt from 'bcryptjs';
import { query, queryOne } from './pool';

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string;
}

export async function createUser(email: string, password: string, displayName?: string): Promise<User> {
  const hash = await bcrypt.hash(password, 12);
  const user = await queryOne<User>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, created_at`,
    [email.toLowerCase().trim(), hash, displayName ?? null],
  );
  if (!user) throw new Error('Failed to create user');
  return user;
}

export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  return queryOne<User & { password_hash: string }>(
    `SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
}

export async function findUserById(id: number): Promise<User | null> {
  return queryOne<User>(
    `SELECT id, email, display_name, created_at FROM users WHERE id = $1`,
    [id],
  );
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
