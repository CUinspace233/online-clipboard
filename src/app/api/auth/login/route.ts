import { NextRequest, NextResponse } from 'next/server';
import { initAuthSchema, verifyUserCredentials, createAuthToken } from '@/lib/db/auth';
import type { LoginRequest, AuthResponse } from '@/types/auth';

let schemaChecked = false;

/**
 * POST /api/auth/login
 * Login user
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize schema on first request
    if (!schemaChecked) {
      await initAuthSchema();
      schemaChecked = true;
    }

    const body: LoginRequest = await request.json();

    // Validate request
    if (!body.username || typeof body.username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Verify credentials
    const user = await verifyUserCredentials(body.username, body.password);

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Create token
    const token = await createAuthToken(user.id);

    const response: AuthResponse = {
      token,
      user,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
