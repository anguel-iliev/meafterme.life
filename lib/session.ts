// lib/session.ts
// iron-session helpers for cookie-based sessions.

import { getIronSession, IronSessionData, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionUser {
  uid: string;
  email: string;
  status: 'WAITLISTED' | 'PENDING_APPROVAL' | 'ACTIVE';
  isAdmin?: boolean;
}

declare module 'iron-session' {
  interface IronSessionData {
    user?: SessionUser;
  }
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'change-me-minimum-32-chars-long-secret-key!!',
  cookieName: 'meafterme_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore as any, sessionOptions);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}
