import { NextRequest, NextResponse } from 'next/server';
import { getClipboardItemById, deleteClipboardItem } from '@/lib/db/clipboard';
import { authenticateRequest } from '@/lib/auth/middleware';

/**
 * GET /api/clipboard/[id]
 * Fetch a single clipboard item by ID
 * Requires authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const itemId = Number(id);

    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const item = await getClipboardItemById(itemId);

    if (!item) {
      return NextResponse.json({ error: 'Clipboard item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('GET /api/clipboard/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch clipboard item' }, { status: 500 });
  }
}

/**
 * DELETE /api/clipboard/[id]
 * Delete a clipboard item by ID
 * Requires authentication
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const itemId = Number(id);

    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const success = await deleteClipboardItem(itemId);

    if (!success) {
      return NextResponse.json({ error: 'Clipboard item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: itemId });
  } catch (error) {
    console.error('DELETE /api/clipboard/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete clipboard item' }, { status: 500 });
  }
}
