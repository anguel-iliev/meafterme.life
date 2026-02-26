import { NextRequest, NextResponse } from 'next/server';
import { listWaitlistSignups } from '@/lib/auth';
import { verifyAdminSecret } from '@/lib/adminAuth';
import { getSessionUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  const hasAdminSecret = verifyAdminSecret(req);
  if (!hasAdminSecret && (!sessionUser || !sessionUser.isAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const signups = await listWaitlistSignups();
  return NextResponse.json({ signups });
}
