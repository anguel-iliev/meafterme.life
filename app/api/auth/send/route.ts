import { NextRequest, NextResponse } from 'next/server';
import { createMagicLinkToken, findOrCreateUser } from '@/lib/auth';
import { sendMagicLinkEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    // Ensure user exists
    await findOrCreateUser(normalized);

    // Create magic link token in Firestore
    const token = await createMagicLinkToken(normalized);

    // Send email
    await sendMagicLinkEmail(normalized, token);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Magic link send error:', error);
    return NextResponse.json({ error: 'Failed to send sign-in link. Please try again.' }, { status: 500 });
  }
}
