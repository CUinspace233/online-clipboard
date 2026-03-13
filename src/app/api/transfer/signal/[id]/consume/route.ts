import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { initTransferSchema, consumeSignalingMessage } from '@/lib/db/transfer';

let schemaChecked = false;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!schemaChecked) {
      await initTransferSchema();
      schemaChecked = true;
    }

    const { id } = await params;
    const messageId = Number(id);

    if (isNaN(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    await consumeSignalingMessage(messageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/transfer/signal/[id]/consume error:', error);
    return NextResponse.json({ error: 'Failed to consume message' }, { status: 500 });
  }
}
