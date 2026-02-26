import { NextRequest, NextResponse } from 'next/server';
import { createInviteCode, listInviteCodes } from '@/lib/auth';
import { verifyAdminSecret } from '@/lib/adminAuth';
import { getSessionUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  const hasAdminSecret = verifyAdminSecret(req);
  if (!hasAdminSecret && (!sessionUser || !sessionUser.isAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const codes = await listInviteCodes();
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  const hasAdminSecret = verifyAdminSecret(req);
  if (!hasAdminSecret && (!sessionUser || !sessionUser.isAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const code = await createInviteCode(body.code, 'admin');
  return NextResponse.json({ code });
}
