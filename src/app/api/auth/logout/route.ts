import { NextRequest, NextResponse } from 'next/server';
import { deleteAuthToken } from '@/lib/db/auth';

/**
 * POST /api/auth/logout
 * Logout user by deleting their token
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    await deleteAuthToken(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/auth/logout error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}
