import { NextRequest, NextResponse } from 'next/server';
import { addWaitlistSignup, findOrCreateUser } from '@/lib/auth';
import { isFirebaseConfigured } from '@/lib/demoStore';
import { sendWaitlistConfirmEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    const result = await addWaitlistSignup(normalized);
    await findOrCreateUser(normalized);

    // Only send confirmation email when real SMTP is configured
    if (result === 'new' && isFirebaseConfigured()) {
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
