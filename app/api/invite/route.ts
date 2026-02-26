import { NextRequest, NextResponse } from 'next/server';
import { redeemInviteCode } from '@/lib/auth';
import { getSessionUser, getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Please sign in before entering your invite code.' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
    }

    const result = await redeemInviteCode(code, sessionUser.email);

    if (result === 'invalid') {
      return NextResponse.json({ error: 'This invite code is invalid.' }, { status: 400 });
    }
    if (result === 'used') {
      return NextResponse.json({ error: 'This invite code has already been used.' }, { status: 400 });
    }

    // Update session status
    const session = await getSession();
    if (session.user) {
      session.user.status = 'PENDING_APPROVAL';
      await session.save();
    }

    return NextResponse.json({ ok: true, status: 'PENDING_APPROVAL' });
  } catch (error: any) {
    console.error('Invite code error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
