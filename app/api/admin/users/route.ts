import { NextRequest, NextResponse } from 'next/server';
import { listPendingUsers, listAllUsers } from '@/lib/auth';
import { verifyAdminSecret } from '@/lib/adminAuth';
import { getSessionUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  // Accept either session-based admin or ADMIN_SECRET header
  const sessionUser = await getSessionUser();
  const hasAdminSecret = verifyAdminSecret(req);
  if (!hasAdminSecret && (!sessionUser || !sessionUser.isAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter');

  const users = filter === 'pending' ? await listPendingUsers() : await listAllUsers();
  return NextResponse.json({ users });
}
