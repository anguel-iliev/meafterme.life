'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyMagicLink, saveCurrentUser } from '@/lib/clientStore';
import { useAuth } from '@/components/AuthContext';

export default function VerifyPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const url = window.location.href;

    verifyMagicLink(url)
      .then((user) => {
        if (!user) {
          setErrorMsg('Invalid or expired link. Please try again.');
          setStatus('error');
          return;
        }
        saveCurrentUser(user);
        setUser(user);
        if (user.status === 'ACTIVE') {
          router.replace('/app/');
        } else if (user.status === 'PENDING_APPROVAL') {
          router.replace('/pending/');
        } else {
          router.replace('/invite/');
        }
      })
      .catch((err) => {
        console.error('Verify error:', err);
        setErrorMsg('Something went wrong. Please try again.');
        setStatus('error');
      });
  }, [router, setUser]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        {status === 'verifying' ? (
          <>
            <div className="w-16 h-16 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">Signing you in…</h2>
            <p className="text-white/60">Please wait while we verify your link.</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-white/60 mb-6">{errorMsg}</p>
            <button
              onClick={() => router.replace('/login/')}
              className="bg-amber-400 text-gray-950 font-bold px-6 py-3 rounded-xl hover:bg-amber-300 transition-colors"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
