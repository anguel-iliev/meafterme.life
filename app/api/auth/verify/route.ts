import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLinkToken, getUserByEmail } from '@/lib/auth';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing-token', req.url));
  }

  try {
    const email = await verifyMagicLinkToken(token);
    if (!email) {
      return NextResponse.redirect(new URL('/login?error=invalid-token', req.url));
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.redirect(new URL('/login?error=user-not-found', req.url));
    }

    // Set session
    const session = await getSession();
    session.user = {
      uid: user.uid,
      email: user.email,
      status: user.status,
    };
    await session.save();

    // Redirect based on status
    if (user.status === 'ACTIVE') {
      return NextResponse.redirect(new URL('/app', req.url));
    } else if (user.status === 'PENDING_APPROVAL') {
      return NextResponse.redirect(new URL('/pending', req.url));
    } else {
      return NextResponse.redirect(new URL('/invite', req.url));
    }
  } catch (error: any) {
    console.error('Magic link verify error:', error);
    return NextResponse.redirect(new URL('/login?error=server-error', req.url));
  }
}
