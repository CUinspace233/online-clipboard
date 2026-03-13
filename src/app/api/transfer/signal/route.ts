import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import {
  initTransferSchema,
  createSignalingMessage,
  getSignalingMessages,
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
    const { from_device_id, to_device_id, type, payload } = body;

    if (!from_device_id || !to_device_id || !type || payload === undefined) {
      return NextResponse.json(
        { error: 'from_device_id, to_device_id, type, and payload are required' },
        { status: 400 }
      );
    }

    const validTypes = [
      'offer',
      'answer',
      'ice-candidate',
      'transfer-request',
      'transfer-accept',
      'transfer-reject',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid signal type' }, { status: 400 });
    }

    const message = await createSignalingMessage(
      user.id,
      from_device_id,
      to_device_id,
      type,
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('POST /api/transfer/signal error:', error);
    return NextResponse.json({ error: 'Failed to send signal' }, { status: 500 });
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
    const afterParam = request.nextUrl.searchParams.get('after');

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
    }

    const afterId = afterParam ? Number(afterParam) : undefined;
    const messages = await getSignalingMessages(deviceId, afterId);

    return NextResponse.json(messages, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('GET /api/transfer/signal error:', error);
    return NextResponse.json({ error: 'Failed to get signals' }, { status: 500 });
  }
}
