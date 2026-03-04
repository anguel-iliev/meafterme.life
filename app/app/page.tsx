'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, type AppUser } from '@/lib/clientStore';
import AppDashboard from './AppDashboard';

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace('/login/');
      return;
    }
    if (u.status === 'PENDING_APPROVAL') {
      router.replace('/pending/');
      return;
    }
    setUser(u);
    setChecked(true);
  }, [router]);

  if (!checked || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return <AppDashboard user={user} />;
}
