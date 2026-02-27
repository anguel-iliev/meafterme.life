'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import AppDashboard from './AppDashboard';

export default function AppPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login/');
      return;
    }
    if (user.status === 'PENDING_APPROVAL') {
      router.replace('/pending/');
      return;
    }
    if (user.status === 'WAITLISTED') {
      router.replace('/invite/');
      return;
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white/60 text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || user.status !== 'ACTIVE') return null;

  return <AppDashboard user={user} />;
}
