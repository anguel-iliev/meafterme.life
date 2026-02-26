import { NextRequest, NextResponse } from 'next/server';
import { addWaitlistSignup, findOrCreateUser } from '@/lib/auth';
import { sendWaitlistConfirmEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    // Add to waitlist collection
    const result = await addWaitlistSignup(normalized);

    // Ensure user document exists (WAITLISTED)
    await findOrCreateUser(normalized);

    // Send confirmation email (non-blocking — don't fail on SMTP error)
    if (result === 'new') {
      try { await sendWaitlistConfirmEmail(normalized); } catch (e) {
        console.warn('Waitlist email failed:', e);
      }
    }

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
