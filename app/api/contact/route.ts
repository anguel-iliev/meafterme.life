import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message, earlyAccess } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    const db = getDb();
    await db.collection('contact_messages').add({
      name,
      email,
      message,
      earlyAccess: !!earlyAccess,
      createdAt: new Date(),
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Contact error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
