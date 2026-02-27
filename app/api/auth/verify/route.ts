import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLinkToken, getUserByEmail, findOrCreateUser } from '@/lib/auth';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  // Build base URL for redirects — use APP_URL env or fallback to request origin
  const appUrl = process.env.APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?error=missing-token`);
  }

  try {
    const email = await verifyMagicLinkToken(token);
    if (!email) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid-token`);
    }

    // Ensure user exists (auto-creates as ACTIVE in demo mode)
    await findOrCreateUser(email);
    const user = await getUserByEmail(email);

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?error=user-not-found`);
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
      return NextResponse.redirect(`${appUrl}/app`);
    } else if (user.status === 'PENDING_APPROVAL') {
      return NextResponse.redirect(`${appUrl}/pending`);
    } else {
      return NextResponse.redirect(`${appUrl}/invite`);
    }
  } catch (error: any) {
    console.error('Magic link verify error:', error);
    return NextResponse.redirect(`${appUrl}/login?error=server-error`);
  }
}
