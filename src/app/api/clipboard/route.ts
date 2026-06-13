import { NextRequest, NextResponse } from 'next/server';
import {
  initSchema,
  getClipboardItems,
  createClipboardItem,
  cleanupOldItems,
  getClipboardItemsCount,
  getFilteredClipboardItemsCount,
} from '@/lib/db/clipboard';
import { authenticateRequest } from '@/lib/auth/middleware';
import { SUPPORTED_LANGUAGES } from '@/lib/clipboard/constants';
import type { ClipboardItemsResponse, CreateClipboardItemData } from '@/types/clipboard';

// Initialize schema on first API call
let schemaChecked = false;

/**
 * GET /api/clipboard
 * Fetch clipboard items with pagination and optional filtering
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize schema on first request
    if (!schemaChecked) {
      await initSchema();
      schemaChecked = true;
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const search = searchParams.get('search')?.trim() || undefined;
    const language = searchParams.get('language')?.trim() || undefined;
    const contentType = searchParams.get('content_type') as 'text/plain' | 'text/code' | null;

    // Validate content_type if provided
    if (contentType && !['text/plain', 'text/code'].includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content_type. Must be "text/plain" or "text/code"' },
        { status: 400 }
      );
    }

    if (
      language &&
      !SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])
    ) {
      return NextResponse.json({ error: 'Invalid language filter' }, { status: 400 });
    }

    const items = await getClipboardItems(
      user.id,
      limit,
      offset,
      contentType || undefined,
      search,
      language
    );
    const total = await getFilteredClipboardItemsCount(
      user.id,
      contentType || undefined,
      search,
      language
    );
    const response: ClipboardItemsResponse = {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('GET /api/clipboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch clipboard items' }, { status: 500 });
  }
}

/**
 * POST /api/clipboard
 * Create a new clipboard item
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize schema on first request
    if (!schemaChecked) {
      await initSchema();
      schemaChecked = true;
    }

    const body = await request.json();

    // Validate request body
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

    // Validate language for code snippets
    if (body.content_type === 'text/code' && !body.language) {
      return NextResponse.json(
        { error: 'language is required for code snippets' },
        { status: 400 }
      );
    }

    const data: CreateClipboardItemData = {
      content: body.content,
      content_type: body.content_type,
      language: body.language,
      metadata: body.metadata,
    };

    const item = await createClipboardItem(user.id, data);

    // Cleanup old items if necessary (keep max 10,000 items)
    const totalCount = await getClipboardItemsCount(user.id);
    if (totalCount > 10000) {
      await cleanupOldItems(user.id, 10000);
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('POST /api/clipboard error:', error);
    return NextResponse.json({ error: 'Failed to create clipboard item' }, { status: 500 });
  }
}
