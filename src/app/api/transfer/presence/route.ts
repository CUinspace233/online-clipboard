import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import {
  initTransferSchema,
  upsertDevicePresence,
  getOnlineDevices,
  cleanupStaleData,
} from '@/lib/db/transfer';

let schemaChecked = false;

async function ensureSchema() {
  if (!schemaChecked) {
    await initTransferSchema();
    schemaChecked = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureSchema();

    const body = await request.json();
    const { device_id, device_name } = body;

    if (!device_id || !device_name) {
      return NextResponse.json(
        { error: 'device_id and device_name are required' },
        { status: 400 }
      );
    }

    const presence = await upsertDevicePresence(user.id, device_id, device_name);

    // Periodically cleanup stale data
    if (Math.random() < 0.1) {
      cleanupStaleData().catch(console.error);
    }

    return NextResponse.json(presence);
  } catch (error) {
    console.error('POST /api/transfer/presence error:', error);
    return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureSchema();

    const deviceId = request.nextUrl.searchParams.get('device_id');
    if (!deviceId) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
    }

    const devices = await getOnlineDevices(user.id, deviceId);

    return NextResponse.json(devices, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('GET /api/transfer/presence error:', error);
    return NextResponse.json({ error: 'Failed to get devices' }, { status: 500 });
  }
}
