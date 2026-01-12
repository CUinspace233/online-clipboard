import { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/db/auth';
import type { User } from '@/types/auth';

/**
 * Extract token from Authorization header
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Authenticate request and return user
 */
export async function authenticateRequest(request: NextRequest): Promise<User | null> {
  const token = extractToken(request);

  if (!token) {
    return null;
  }

  return await verifyAuthToken(token);
}

/**
 * Check if request is authenticated
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const user = await authenticateRequest(request);
  return user !== null;
}
