import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/db/auth';

/**
 * GET /api/auth/verify
 * Verify authentication token and return user info
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyAuthToken(token);

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('GET /api/auth/verify error:', error);
    return NextResponse.json({ error: 'Failed to verify token' }, { status: 500 });
  }
}
