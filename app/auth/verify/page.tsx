'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * /auth/verify/ — landing page for Firebase email verification links.
 * Firebase sends a verification email with a link to this page (via continueUrl).
 * After verification the user is told to go log in.
 */
export default function VerifyPage() {
  const [status, setStatus] = useState<'checking' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Firebase email verification happens automatically when the user clicks
    // the link in the email — Firebase validates the oobCode server-side.
    // When user arrives here after clicking the email link, we just show success.
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode === 'verifyEmail' && oobCode) {
      // Apply the action code using Firebase Auth
      import('firebase/auth').then(async ({ applyActionCode, getAuth }) => {
        const { getFirebaseApp, isFirebaseClientConfigured } = await import('@/lib/firebaseClient');
        if (!isFirebaseClientConfigured()) {
          setStatus('done');
          setMessage('Имейлът е потвърден (demo режим). Можете да влезете.');
          return;
        }
        try {
          const auth = getAuth(getFirebaseApp());
          await applyActionCode(auth, oobCode);
          setStatus('done');
          setMessage('Имейлът ви беше успешно потвърден! Вече можете да влезете в профила си.');
        } catch (err: any) {
          console.error('applyActionCode error:', err);
          if (err.code === 'auth/invalid-action-code') {
            setStatus('done');
            setMessage('Линкът вече е използван или е изтекъл. Ако сте се потвърдили преди, просто влезте.');
          } else {
            setStatus('error');
            setMessage('Неуспешно потвърждение: ' + (err.message || 'Непозната грешка'));
          }
        }
      });
    } else if (mode === 'resetPassword') {
      // Redirect to a reset password flow if needed — for now just go to login
      window.location.href = '/login/';
    } else {
      // No mode or unrecognized — just show a generic "verified" message
      setStatus('done');
      setMessage('Имейлът е потвърден. Можете да влезете в профила си.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
        {status === 'checking' && (
          <>
            <div className="w-14 h-14 border-4 border-brand-400/30 border-t-brand-400 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Проверка…</h2>
            <p className="text-gray-500 text-sm">Моля, изчакайте.</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="text-6xl mb-5">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Готово!</h2>
            <p className="text-gray-600 mb-8">{message}</p>
            <Link
              href="/login/"
              className="block w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors text-center"
            >
              Влезте в профила →
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Грешка</h2>
            <p className="text-gray-500 mb-6 text-sm">{message}</p>
            <Link
              href="/login/"
              className="block w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors text-center"
            >
              Назад към вход
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
