// Shared admin auth helper
import { NextRequest } from 'next/server';

export function verifyAdminSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return false;
  return secret === adminSecret;
}
