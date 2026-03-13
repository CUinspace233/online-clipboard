import { createClient } from '@libsql/client';
import type { DevicePresence, SignalingMessage } from '@/types/transfer';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

let transferSchemaInitialized = false;

export async function initTransferSchema(): Promise<void> {
  if (transferSchemaInitialized) {
    return;
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS device_presence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        last_seen_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(user_id, device_id)
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_device_presence_user
      ON device_presence(user_id, last_seen_at)
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS signaling_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        from_device_id TEXT NOT NULL,
        to_device_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        consumed INTEGER NOT NULL DEFAULT 0
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_signaling_to_device
      ON signaling_messages(to_device_id, consumed, id)
    `);

    transferSchemaInitialized = true;
    console.log('Transfer schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize transfer schema:', error);
    throw error;
  }
}

export async function upsertDevicePresence(
  userId: number,
  deviceId: string,
  deviceName: string
): Promise<DevicePresence> {
  const now = Date.now();

  const result = await client.execute({
    sql: `
      INSERT INTO device_presence (user_id, device_id, device_name, last_seen_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, device_id) DO UPDATE SET
        device_name = excluded.device_name,
        last_seen_at = excluded.last_seen_at
      RETURNING *
    `,
    args: [userId, deviceId, deviceName, now, now],
  });

  const row = result.rows[0];
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    device_id: String(row.device_id),
    device_name: String(row.device_name),
    last_seen_at: Number(row.last_seen_at),
    created_at: Number(row.created_at),
  };
}

export async function getOnlineDevices(
  userId: number,
  excludeDeviceId: string
): Promise<DevicePresence[]> {
  const threshold = Date.now() - 30_000; // 30 seconds

  const result = await client.execute({
    sql: `
      SELECT * FROM device_presence
      WHERE user_id = ? AND device_id != ? AND last_seen_at > ?
      ORDER BY last_seen_at DESC
    `,
    args: [userId, excludeDeviceId, threshold],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    device_id: String(row.device_id),
    device_name: String(row.device_name),
    last_seen_at: Number(row.last_seen_at),
    created_at: Number(row.created_at),
  }));
}

export async function removeDevice(userId: number, deviceId: string): Promise<void> {
  await client.execute({
    sql: `DELETE FROM device_presence WHERE user_id = ? AND device_id = ?`,
    args: [userId, deviceId],
  });
}

export async function createSignalingMessage(
  userId: number,
  fromDeviceId: string,
  toDeviceId: string,
  type: string,
  payload: string
): Promise<SignalingMessage> {
  const now = Date.now();

  const result = await client.execute({
    sql: `
      INSERT INTO signaling_messages (user_id, from_device_id, to_device_id, type, payload, created_at, consumed)
      VALUES (?, ?, ?, ?, ?, ?, 0)
      RETURNING *
    `,
    args: [userId, fromDeviceId, toDeviceId, type, payload, now],
  });

  const row = result.rows[0];
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    from_device_id: String(row.from_device_id),
    to_device_id: String(row.to_device_id),
    type: String(row.type) as SignalingMessage['type'],
    payload: String(row.payload),
    created_at: Number(row.created_at),
    consumed: Number(row.consumed),
  };
}

export async function getSignalingMessages(
  toDeviceId: string,
  afterId?: number
): Promise<SignalingMessage[]> {
  const result = await client.execute({
    sql: `
      SELECT * FROM signaling_messages
      WHERE to_device_id = ? AND consumed = 0 ${afterId ? 'AND id > ?' : ''}
      ORDER BY id ASC
    `,
    args: afterId ? [toDeviceId, afterId] : [toDeviceId],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    from_device_id: String(row.from_device_id),
    to_device_id: String(row.to_device_id),
    type: String(row.type) as SignalingMessage['type'],
    payload: String(row.payload),
    created_at: Number(row.created_at),
    consumed: Number(row.consumed),
  }));
}

export async function consumeSignalingMessage(id: number): Promise<void> {
  await client.execute({
    sql: `UPDATE signaling_messages SET consumed = 1 WHERE id = ?`,
    args: [id],
  });
}

export async function cleanupStaleData(): Promise<void> {
  const now = Date.now();
  const signalingCutoff = now - 5 * 60 * 1000; // 5 minutes
  const deviceCutoff = now - 60_000; // 60 seconds

  await client.execute({
    sql: `DELETE FROM signaling_messages WHERE created_at < ?`,
    args: [signalingCutoff],
  });

  await client.execute({
    sql: `DELETE FROM device_presence WHERE last_seen_at < ?`,
    args: [deviceCutoff],
  });
}
