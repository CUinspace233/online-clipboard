import { NextRequest, NextResponse } from 'next/server';
import {
  initAuthSchema,
  updateUserPassword,
  deleteAllAuthTokensForUser,
} from '@/lib/db/auth';
import { authenticateRequest } from '@/lib/auth/middleware';
import type { ChangePasswordRequest } from '@/types/auth';

let schemaChecked = false;

/**
 * POST /api/auth/change-password
 * Change the authenticated user's password.
 * Requires a valid Bearer token and the current password.
 */
export async function POST(request: NextRequest) {
  try {
    if (!schemaChecked) {
      await initAuthSchema();
      schemaChecked = true;
    }

    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body: ChangePasswordRequest = await request.json();

    if (!body.currentPassword || typeof body.currentPassword !== 'string') {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      );
    }

    if (!body.newPassword || typeof body.newPassword !== 'string') {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    if (body.newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (body.currentPassword === body.newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from the current password' },
        { status: 400 }
      );
    }

    await updateUserPassword(user.id, body.currentPassword, body.newPassword);

    // Invalidate all sessions by removing the user's tokens.
    await deleteAllAuthTokensForUser(user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Current password is incorrect') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'User not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('POST /api/auth/change-password error:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
