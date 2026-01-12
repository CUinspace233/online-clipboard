import { NextRequest, NextResponse } from 'next/server';
import { initAuthSchema, createUser, createAuthToken } from '@/lib/db/auth';
import type { RegisterRequest, AuthResponse } from '@/types/auth';

let schemaChecked = false;

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize schema on first request
    if (!schemaChecked) {
      await initAuthSchema();
      schemaChecked = true;
    }

    const body: RegisterRequest = await request.json();

    // Validate request
    if (!body.username || typeof body.username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Validate username length
    if (body.username.length < 3 || body.username.length > 50) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 50 characters' },
        { status: 400 }
      );
    }

    // Validate password length
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Validate username format (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Create user
    const user = await createUser(body.username, body.password);

    // Create token
    const token = await createAuthToken(user.id);

    const response: AuthResponse = {
      token,
      user,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Username already exists') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('POST /api/auth/register error:', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}
