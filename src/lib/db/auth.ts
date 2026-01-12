import { createClient } from '@libsql/client';
import type { User } from '@/types/auth';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

let authSchemaInitialized = false;

/**
 * Initialize authentication schema
 */
export async function initAuthSchema(): Promise<void> {
  if (authSchemaInitialized) {
    return;
  }

  try {
    // Create users table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Create tokens table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_username ON users(username)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_token ON auth_tokens(token)
    `);

    authSchemaInitialized = true;
    console.log('Authentication schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize auth schema:', error);
    throw error;
  }
}

/**
 * Simple hash function (NOT secure for production - use bcrypt in production)
 */
function hashPassword(password: string): string {
  // For simplicity, using basic encoding. In production, use bcrypt or argon2
  return Buffer.from(password).toString('base64');
}

/**
 * Verify password
 */
function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Generate a random token
 */
function generateToken(): string {
  return Buffer.from(Math.random().toString() + Date.now().toString())
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 64);
}

/**
 * Create a new user
 */
export async function createUser(username: string, password: string): Promise<User> {
  try {
    const passwordHash = hashPassword(password);
    const now = Date.now();

    const result = await client.execute({
      sql: `
        INSERT INTO users (username, password_hash, created_at)
        VALUES (?, ?, ?)
        RETURNING id, username, created_at
      `,
      args: [username, passwordHash, now],
    });

    const row = result.rows[0];
    return {
      id: Number(row.id),
      username: String(row.username),
      created_at: Number(row.created_at),
    };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('Username already exists');
    }
    console.error('Failed to create user:', error);
    throw error;
  }
}

/**
 * Find user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  try {
    const result = await client.execute({
      sql: `SELECT id, username, created_at FROM users WHERE username = ?`,
      args: [username],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      username: String(row.username),
      created_at: Number(row.created_at),
    };
  } catch (error) {
    console.error('Failed to find user:', error);
    throw error;
  }
}

/**
 * Verify user credentials
 */
export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<User | null> {
  try {
    const result = await client.execute({
      sql: `SELECT id, username, password_hash, created_at FROM users WHERE username = ?`,
      args: [username],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const passwordHash = String(row.password_hash);

    if (!verifyPassword(password, passwordHash)) {
      return null;
    }

    return {
      id: Number(row.id),
      username: String(row.username),
      created_at: Number(row.created_at),
    };
  } catch (error) {
    console.error('Failed to verify credentials:', error);
    throw error;
  }
}

/**
 * Create authentication token
 */
export async function createAuthToken(userId: number): Promise<string> {
  try {
    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    await client.execute({
      sql: `
        INSERT INTO auth_tokens (user_id, token, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `,
      args: [userId, token, now, expiresAt],
    });

    return token;
  } catch (error) {
    console.error('Failed to create auth token:', error);
    throw error;
  }
}

/**
 * Verify authentication token and return user
 */
export async function verifyAuthToken(token: string): Promise<User | null> {
  try {
    const result = await client.execute({
      sql: `
        SELECT u.id, u.username, u.created_at
        FROM auth_tokens t
        JOIN users u ON t.user_id = u.id
        WHERE t.token = ? AND t.expires_at > ?
      `,
      args: [token, Date.now()],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      username: String(row.username),
      created_at: Number(row.created_at),
    };
  } catch (error) {
    console.error('Failed to verify token:', error);
    throw error;
  }
}

/**
 * Delete authentication token (logout)
 */
export async function deleteAuthToken(token: string): Promise<boolean> {
  try {
    const result = await client.execute({
      sql: `DELETE FROM auth_tokens WHERE token = ?`,
      args: [token],
    });

    return result.rowsAffected > 0;
  } catch (error) {
    console.error('Failed to delete token:', error);
    throw error;
  }
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await client.execute({
      sql: `DELETE FROM auth_tokens WHERE expires_at < ?`,
      args: [Date.now()],
    });

    return result.rowsAffected;
  } catch (error) {
    console.error('Failed to cleanup expired tokens:', error);
    throw error;
  }
}
