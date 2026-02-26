import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.redirect(new URL('/', req.url));
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
