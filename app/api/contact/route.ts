import { NextRequest, NextResponse } from 'next/server';
import { isFirebaseConfigured, demoAddContactMessage } from '@/lib/demoStore';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message, earlyAccess } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (!isFirebaseConfigured()) {
      // Demo mode — store in memory
      demoAddContactMessage({ name, email, message, earlyAccess: !!earlyAccess });
      return NextResponse.json({ ok: true });
    }

    const { getDb } = await import('@/lib/firebase');
    const db = getDb();
    await db.collection('contact_messages').add({
      name, email, message,
      earlyAccess: !!earlyAccess,
      createdAt: new Date(),
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Contact error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
