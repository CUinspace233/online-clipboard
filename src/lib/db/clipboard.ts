import { createClient } from '@libsql/client';
import type { ClipboardItem, CreateClipboardItemData } from '@/types/clipboard';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

let schemaInitialized = false;

/**
 * Initialize database schema
 * Creates clipboard_items table and indexes if they don't exist
 */
export async function initSchema(): Promise<void> {
  if (schemaInitialized) {
    return;
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS clipboard_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        content_type VARCHAR(50) NOT NULL DEFAULT 'text/plain',
        language VARCHAR(50) NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT NULL
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_created_at ON clipboard_items(created_at DESC)
    `);

    schemaInitialized = true;
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}

/**
 * Get clipboard items with pagination and optional filtering
 */
export async function getClipboardItems(
  limit: number = 50,
  offset: number = 0,
  contentType?: 'text/plain' | 'text/code'
): Promise<ClipboardItem[]> {
  try {
    let query = `
      SELECT id, content, content_type, language, created_at, updated_at, metadata
      FROM clipboard_items
    `;
    const params: (string | number)[] = [];

    if (contentType) {
      query += ` WHERE content_type = ?`;
      params.push(contentType);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await client.execute({
      sql: query,
      args: params,
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      content: String(row.content),
      content_type: row.content_type as 'text/plain' | 'text/code',
      language: row.language ? String(row.language) : undefined,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      metadata: row.metadata ? String(row.metadata) : undefined,
    }));
  } catch (error) {
    console.error('Failed to get clipboard items:', error);
    throw error;
  }
}

/**
 * Get a single clipboard item by ID
 */
export async function getClipboardItemById(id: number): Promise<ClipboardItem | null> {
  try {
    const result = await client.execute({
      sql: `
        SELECT id, content, content_type, language, created_at, updated_at, metadata
        FROM clipboard_items
        WHERE id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: Number(row.id),
      content: String(row.content),
      content_type: row.content_type as 'text/plain' | 'text/code',
      language: row.language ? String(row.language) : undefined,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      metadata: row.metadata ? String(row.metadata) : undefined,
    };
  } catch (error) {
    console.error('Failed to get clipboard item:', error);
    throw error;
  }
}

/**
 * Create a new clipboard item
 */
export async function createClipboardItem(data: CreateClipboardItemData): Promise<ClipboardItem> {
  try {
    const now = Date.now();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

    const result = await client.execute({
      sql: `
        INSERT INTO clipboard_items (content, content_type, language, created_at, updated_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id, content, content_type, language, created_at, updated_at, metadata
      `,
      args: [data.content, data.content_type, data.language || null, now, now, metadata],
    });

    const row = result.rows[0];
    return {
      id: Number(row.id),
      content: String(row.content),
      content_type: row.content_type as 'text/plain' | 'text/code',
      language: row.language ? String(row.language) : undefined,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      metadata: row.metadata ? String(row.metadata) : undefined,
    };
  } catch (error) {
    console.error('Failed to create clipboard item:', error);
    throw error;
  }
}

/**
 * Delete a clipboard item by ID
 */
export async function deleteClipboardItem(id: number): Promise<boolean> {
  try {
    const result = await client.execute({
      sql: `DELETE FROM clipboard_items WHERE id = ?`,
      args: [id],
    });

    return result.rowsAffected > 0;
  } catch (error) {
    console.error('Failed to delete clipboard item:', error);
    throw error;
  }
}

/**
 * Clean up old clipboard items, keeping only the specified count
 */
export async function cleanupOldItems(keepCount: number = 10000): Promise<number> {
  try {
    const result = await client.execute({
      sql: `
        DELETE FROM clipboard_items
        WHERE id NOT IN (
          SELECT id FROM clipboard_items
          ORDER BY created_at DESC
          LIMIT ?
        )
      `,
      args: [keepCount],
    });

    const deletedCount = result.rowsAffected;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old clipboard items`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old items:', error);
    throw error;
  }
}

/**
 * Get total count of clipboard items
 */
export async function getClipboardItemsCount(): Promise<number> {
  try {
    const result = await client.execute(`SELECT COUNT(*) as count FROM clipboard_items`);
    return Number(result.rows[0].count);
  } catch (error) {
    console.error('Failed to get clipboard items count:', error);
    throw error;
  }
}
