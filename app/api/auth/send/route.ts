import { NextRequest, NextResponse } from 'next/server';
import { createMagicLinkToken, findOrCreateUser } from '@/lib/auth';
import { sendMagicLinkEmail } from '@/lib/mailer';
import { isFirebaseConfigured } from '@/lib/demoStore';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    // Ensure user exists (demo: auto ACTIVE)
    await findOrCreateUser(normalized);

    // Create token (demo: in-memory, production: Firestore)
    const token = await createMagicLinkToken(normalized);

    if (!isFirebaseConfigured()) {
      // DEMO MODE — return the sign-in link directly (no email needed)
      const appUrl = process.env.APP_URL || '';
      const link = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
      return NextResponse.json({ ok: true, demo: true, link });
    }

    // PRODUCTION MODE — send real email
    await sendMagicLinkEmail(normalized, token);
    return NextResponse.json({ ok: true, demo: false });

  } catch (error: any) {
    console.error('Magic link send error:', error);
    return NextResponse.json({ error: 'Failed to send sign-in link. Please try again.' }, { status: 500 });
  }
}
