import { NextRequest, NextResponse } from 'next/server';
import {
  deleteClipboardItem,
  getClipboardItemById,
  initSchema,
  updateClipboardItem,
} from '@/lib/db/clipboard';
import { authenticateRequest } from '@/lib/auth/middleware';
import type { UpdateClipboardItemData } from '@/types/clipboard';

let schemaChecked = false;

async function ensureClipboardSchema() {
  if (!schemaChecked) {
    await initSchema();
    schemaChecked = true;
  }
}

/**
 * GET /api/clipboard/[id]
 * Fetch a single clipboard item by ID
 * Requires authentication
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
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

    const item = await getClipboardItemById(user.id, itemId);

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
 * PATCH /api/clipboard/[id]
 * Update a clipboard item by ID
 * Requires authentication
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
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

    const body = await request.json();

    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    if (body.content.length > 100000) {
      return NextResponse.json(
        { error: 'Content exceeds maximum length of 100,000 characters' },
        { status: 400 }
      );
    }

    if (!body.content_type || !['text/plain', 'text/code'].includes(body.content_type)) {
      return NextResponse.json(
        { error: 'content_type is required and must be "text/plain" or "text/code"' },
        { status: 400 }
      );
    }

    if (body.content_type === 'text/code' && !body.language) {
      return NextResponse.json(
        { error: 'language is required for code snippets' },
        { status: 400 }
      );
    }

    const data: UpdateClipboardItemData = {
      content: body.content,
      content_type: body.content_type,
      language: body.content_type === 'text/code' ? body.language : undefined,
      metadata: body.metadata,
    };

    const item = await updateClipboardItem(user.id, itemId, data);

    if (!item) {
      return NextResponse.json({ error: 'Clipboard item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('PATCH /api/clipboard/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update clipboard item' }, { status: 500 });
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

    await ensureClipboardSchema();

    const { id } = await params;
    const itemId = Number(id);

    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const success = await deleteClipboardItem(user.id, itemId);

    if (!success) {
      return NextResponse.json({ error: 'Clipboard item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: itemId });
  } catch (error) {
    console.error('DELETE /api/clipboard/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete clipboard item' }, { status: 500 });
  }
}
