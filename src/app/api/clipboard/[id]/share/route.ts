import { NextRequest, NextResponse } from 'next/server';
import {
  disableClipboardItemSharing,
  enableClipboardItemSharing,
  initSchema,
} from '@/lib/db/clipboard';
import { authenticateRequest } from '@/lib/auth/middleware';

let schemaChecked = false;

async function ensureClipboardSchema() {
  if (!schemaChecked) {
    await initSchema();
    schemaChecked = true;
  }
}

/**
 * POST /api/clipboard/[id]/share
 * Enable sharing for a clipboard item
 * Requires authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureClipboardSchema();

    const { id } = await params;
    const itemId = Number(id);

    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const item = await enableClipboardItemSharing(itemId);

    if (!item || !item.share_token) {
      return NextResponse.json({ error: 'Clipboard item not found' }, { status: 404 });
    }

    const shareUrl = `${request.nextUrl.origin}/share/${item.share_token}`;

    return NextResponse.json({
      share_token: item.share_token,
      share_url: shareUrl,
      item,
    });
  } catch (error) {
    console.error('POST /api/clipboard/[id]/share error:', error);
    return NextResponse.json({ error: 'Failed to enable sharing' }, { status: 500 });
  }
}

/**
 * DELETE /api/clipboard/[id]/share
 * Disable sharing for a clipboard item
 * Requires authentication
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureClipboardSchema();

    const { id } = await params;
    const itemId = Number(id);

    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const item = await disableClipboardItemSharing(itemId);

    if (!item) {
      return NextResponse.json({ error: 'Clipboard item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('DELETE /api/clipboard/[id]/share error:', error);
    return NextResponse.json({ error: 'Failed to disable sharing' }, { status: 500 });
  }
}
