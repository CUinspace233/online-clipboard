import { randomUUID } from 'crypto';
import { createClient } from '@libsql/client';
import type {
  ClipboardItem,
  CreateClipboardItemData,
  SharedClipboardItem,
  UpdateClipboardItemData,
} from '@/types/clipboard';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

let schemaInitialized = false;

interface ClipboardItemFilters {
  contentType?: 'text/plain' | 'text/code';
  search?: string;
  language?: string;
}

function buildClipboardItemsWhereClause(filters: ClipboardItemFilters = {}) {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (filters.contentType) {
    conditions.push('content_type = ?');
    args.push(filters.contentType);
  }

  if (filters.search) {
    conditions.push('LOWER(content) LIKE ?');
    const searchPattern = `%${filters.search.toLowerCase()}%`;
    args.push(searchPattern);
  }

  if (filters.language) {
    conditions.push('language = ?');
    args.push(filters.language);
  }

  return {
    whereClause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    args,
  };
}

function mapRowToClipboardItem(row: Record<string, unknown>): ClipboardItem {
  return {
    id: Number(row.id),
    content: String(row.content),
    content_type: row.content_type as 'text/plain' | 'text/code',
    language: row.language ? String(row.language) : undefined,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    metadata: row.metadata ? String(row.metadata) : undefined,
    share_token: row.share_token ? String(row.share_token) : null,
  };
}

function mapRowToSharedClipboardItem(row: Record<string, unknown>): SharedClipboardItem {
  return {
    content: String(row.content),
    content_type: row.content_type as 'text/plain' | 'text/code',
    language: row.language ? String(row.language) : undefined,
    created_at: Number(row.created_at),
  };
}

async function migrateShareTokenColumn(): Promise<void> {
  const tableInfo = await client.execute(`PRAGMA table_info(clipboard_items)`);
  const hasShareToken = tableInfo.rows.some(row => row.name === 'share_token');

  if (!hasShareToken) {
    await client.execute(`ALTER TABLE clipboard_items ADD COLUMN share_token TEXT NULL`);
  }

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_share_token ON clipboard_items(share_token) WHERE share_token IS NOT NULL
  `);
}

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

    await migrateShareTokenColumn();

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
  contentType?: 'text/plain' | 'text/code',
  search?: string,
  language?: string
): Promise<ClipboardItem[]> {
  try {
    const { whereClause, args } = buildClipboardItemsWhereClause({
      contentType,
      search,
      language,
    });

    const query = `
      SELECT id, content, content_type, language, created_at, updated_at, metadata, share_token
      FROM clipboard_items
      ${whereClause}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `;

    const result = await client.execute({
      sql: query,
      args: [...args, limit, offset],
    });

    return result.rows.map(row => mapRowToClipboardItem(row as Record<string, unknown>));
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
        SELECT id, content, content_type, language, created_at, updated_at, metadata, share_token
        FROM clipboard_items
        WHERE id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToClipboardItem(result.rows[0] as Record<string, unknown>);
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
        RETURNING id, content, content_type, language, created_at, updated_at, metadata, share_token
      `,
      args: [data.content, data.content_type, data.language || null, now, now, metadata],
    });

    return mapRowToClipboardItem(result.rows[0] as Record<string, unknown>);
  } catch (error) {
    console.error('Failed to create clipboard item:', error);
    throw error;
  }
}

/**
 * Update an existing clipboard item by ID
 */
export async function updateClipboardItem(
  id: number,
  data: UpdateClipboardItemData
): Promise<ClipboardItem | null> {
  try {
    const now = Date.now();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

    const result = await client.execute({
      sql: `
        UPDATE clipboard_items
        SET content = ?, content_type = ?, language = ?, updated_at = ?, metadata = ?
        WHERE id = ?
        RETURNING id, content, content_type, language, created_at, updated_at, metadata, share_token
      `,
      args: [data.content, data.content_type, data.language || null, now, metadata, id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToClipboardItem(result.rows[0] as Record<string, unknown>);
  } catch (error) {
    console.error('Failed to update clipboard item:', error);
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

/**
 * Get count of clipboard items with optional filtering
 */
export async function getFilteredClipboardItemsCount(
  contentType?: 'text/plain' | 'text/code',
  search?: string,
  language?: string
): Promise<number> {
  try {
    const { whereClause, args } = buildClipboardItemsWhereClause({
      contentType,
      search,
      language,
    });

    const result = await client.execute({
      sql: `SELECT COUNT(*) as count FROM clipboard_items${whereClause}`,
      args,
    });

    return Number(result.rows[0].count);
  } catch (error) {
    console.error('Failed to get filtered clipboard items count:', error);
    throw error;
  }
}

/**
 * Enable sharing for a clipboard item, reusing existing token if present
 */
export async function enableClipboardItemSharing(id: number): Promise<ClipboardItem | null> {
  try {
    const existing = await getClipboardItemById(id);
    if (!existing) {
      return null;
    }

    const shareToken = existing.share_token || randomUUID();
    const now = Date.now();

    const result = await client.execute({
      sql: `
        UPDATE clipboard_items
        SET share_token = ?, updated_at = ?
        WHERE id = ?
        RETURNING id, content, content_type, language, created_at, updated_at, metadata, share_token
      `,
      args: [shareToken, now, id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToClipboardItem(result.rows[0] as Record<string, unknown>);
  } catch (error) {
    console.error('Failed to enable clipboard item sharing:', error);
    throw error;
  }
}

/**
 * Disable sharing for a clipboard item
 */
export async function disableClipboardItemSharing(id: number): Promise<ClipboardItem | null> {
  try {
    const now = Date.now();

    const result = await client.execute({
      sql: `
        UPDATE clipboard_items
        SET share_token = NULL, updated_at = ?
        WHERE id = ?
        RETURNING id, content, content_type, language, created_at, updated_at, metadata, share_token
      `,
      args: [now, id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToClipboardItem(result.rows[0] as Record<string, unknown>);
  } catch (error) {
    console.error('Failed to disable clipboard item sharing:', error);
    throw error;
  }
}

/**
 * Get a shared clipboard item by share token (public access)
 */
export async function getClipboardItemByShareToken(
  token: string
): Promise<SharedClipboardItem | null> {
  try {
    const result = await client.execute({
      sql: `
        SELECT content, content_type, language, created_at
        FROM clipboard_items
        WHERE share_token = ?
      `,
      args: [token],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToSharedClipboardItem(result.rows[0] as Record<string, unknown>);
  } catch (error) {
    console.error('Failed to get clipboard item by share token:', error);
    throw error;
  }
}
