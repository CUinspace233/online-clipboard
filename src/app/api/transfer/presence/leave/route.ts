import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { verifyAuthToken } from '@/lib/db/auth';
import { initTransferSchema, removeDevice } from '@/lib/db/transfer';

let schemaChecked = false;

export async function POST(request: NextRequest) {
  try {
    if (!schemaChecked) {
      await initTransferSchema();
      schemaChecked = true;
    }

    const body = await request.json();
    const { device_id, token } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
    }

    // Support both Authorization header (normal fetch) and body token (sendBeacon)
    let user = await authenticateRequest(request);
    if (!user && token) {
      user = await verifyAuthToken(token);
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await removeDevice(user.id, device_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/transfer/presence/leave error:', error);
    return NextResponse.json({ error: 'Failed to remove device' }, { status: 500 });
  }
}
