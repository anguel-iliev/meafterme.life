import { NextRequest, NextResponse } from 'next/server';
import { adminApproveUser } from '@/lib/auth';
import { verifyAdminSecret } from '@/lib/adminAuth';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  const hasAdminSecret = verifyAdminSecret(req);
  if (!hasAdminSecret && (!sessionUser || !sessionUser.isAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = await req.json();
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });

  await adminApproveUser(uid);
  return NextResponse.json({ ok: true });
}
