'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/LangContext';
import { registerWithEmailPassword, loginWithEmailPassword } from '@/lib/clientStore';

function validatePassword(password: string, t: any): string | null {
  if (password.length < 8) return t.err_minLength;
  if (!/[A-Z]/.test(password)) return t.err_uppercase;
  if (!/[a-z]/.test(password)) return t.err_lowercase;
  if (!/[0-9]/.test(password)) return t.err_digit;
  if (!/[^A-Za-z0-9]/.test(password)) return t.err_special;
  return null;
}

type Mode = 'login' | 'register';

const i18n = {
  en: {
    tabLogin: 'Sign In', tabRegister: 'Register',
    labelEmail: 'Email address', labelPassword: 'Password',
    labelConfirm: 'Confirm password',
    placeholderEmail: 'your@email.com',
    placeholderPw: 'Min. 8 chars, number, special char',
    placeholderConfirm: 'Repeat password',
    btnLogin: 'Sign In', btnRegister: 'Create Account',
    noAccount: "Don't have an account?", registerLink: 'Register for free',
    haveAccount: 'Already have an account?', loginLink: 'Sign in here',
    backHome: '← Back to home',
    verifyTitle: 'Verify your email',
    verifyCopy: 'We sent an activation link to:',
    verifyInfo: 'Click the link in the email to activate your account. Then come back here to sign in.',
    btnAfterVerify: 'Sign in after confirmation',
    verifySpam: "Didn't receive the email? Check your Spam folder.",
    strength: 'Strength:', sw: ['Weak', 'Fair', 'Good', 'Strong'],
    req_title: 'Password requirements:',
    req: ['At least 8 characters', 'At least one uppercase letter (A–Z)', 'At least one lowercase letter (a–z)', 'At least one digit (0–9)', 'At least one special character (!@#$%...)'],
    err_match: 'Passwords do not match.',
    err_minLength: 'Password must be at least 8 characters.',
    err_uppercase: 'Password must contain at least one uppercase letter.',
    err_lowercase: 'Password must contain at least one lowercase letter.',
    err_digit: 'Password must contain at least one digit.',
    err_special: 'Password must contain at least one special character.',
    err_notVerified: 'Please verify your email before signing in. Check your inbox.',
    e_inUse: 'An account with this email already exists. Sign in instead.',
    e_invalid: 'Invalid email address.',
    e_notFound: 'Incorrect email or password.',
    e_tooMany: 'Too many attempts. Please wait a moment and try again.',
    e_disabled: 'This account has been disabled. Contact support.',
  },
  bg: {
    tabLogin: 'Вход', tabRegister: 'Регистрация',
    labelEmail: 'Имейл адрес', labelPassword: 'Парола',
    labelConfirm: 'Потвърди паролата',
    placeholderEmail: 'your@email.com',
    placeholderPw: 'Мин. 8 символа, цифра, специален знак',
    placeholderConfirm: 'Повтори паролата',
    btnLogin: 'Влез', btnRegister: 'Регистрирай се',
    noAccount: 'Нямате акаунт?', registerLink: 'Регистрирайте се безплатно',
    haveAccount: 'Вече имате акаунт?', loginLink: 'Влезте тук',
    backHome: '← Назад към началото',
    verifyTitle: 'Потвърдете имейла си',
    verifyCopy: 'Изпратихме линк за активация на:',
    verifyInfo: 'Кликнете линка в имейла, за да активирате акаунта си. След активацията се върнете тук и влезте.',
    btnAfterVerify: 'Вход след потвърждение',
    verifySpam: 'Не получихте имейл? Проверете папката Спам.',
    strength: 'Сила:', sw: ['Слаба', 'Средна', 'Добра', 'Силна'],
    req_title: 'Изисквания за паролата:',
    req: ['Поне 8 символа', 'Поне една главна буква (A–Z)', 'Поне една малка буква (a–z)', 'Поне една цифра (0–9)', 'Поне един специален символ (!@#$%...)'],
    err_match: 'Паролите не съвпадат.',
    err_minLength: 'Паролата трябва да е поне 8 символа.',
    err_uppercase: 'Паролата трябва да съдържа поне една главна буква.',
    err_lowercase: 'Паролата трябва да съдържа поне една малка буква.',
    err_digit: 'Паролата трябва да съдържа поне една цифра.',
    err_special: 'Паролата трябва да съдържа поне един специален символ.',
    err_notVerified: 'Моля, потвърдете имейла си преди да влезете. Проверете входящата си кутия.',
    e_inUse: 'Вече съществува акаунт с този имейл. Влезте вместо това.',
    e_invalid: 'Невалиден имейл адрес.',
    e_notFound: 'Грешен имейл или парола.',
    e_tooMany: 'Твърде много опити. Моля, изчакайте малко и опитайте отново.',
    e_disabled: 'Акаунтът е деактивиран. Свържете се с поддръжката.',
  },
};

export default function LoginPage() {
  const { locale } = useLang();
  const t = i18n[locale as 'en' | 'bg'] || i18n.en;

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const pwChecks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const pwScore = pwChecks.filter(Boolean).length;
  const pwStrengthColor = pwScore <= 2 ? 'bg-red-400' : pwScore <= 3 ? 'bg-yellow-400' : pwScore <= 4 ? 'bg-blue-400' : 'bg-green-500';
  const pwStrengthLabel = pwScore <= 2 ? t.sw[0] : pwScore <= 3 ? t.sw[1] : pwScore <= 4 ? t.sw[2] : t.sw[3];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const pwError = validatePassword(password, t);
        if (pwError) { setError(pwError); setLoading(false); return; }
        if (password !== confirmPassword) { setError(t.err_match); setLoading(false); return; }
        await registerWithEmailPassword(email, password);
        setVerificationSent(true);
      } else {
        const user = await loginWithEmailPassword(email, password);
        if (!user.emailVerified) { setError(t.err_notVerified); setLoading(false); return; }
        window.location.href = '/app/';
      }
    } catch (err: any) {
      let msg = err.message || 'Error';
      if (msg.includes('auth/email-already-in-use')) msg = t.e_inUse;
      else if (msg.includes('auth/invalid-email')) msg = t.e_invalid;
      else if (msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password') || msg.includes('auth/invalid-credential')) msg = t.e_notFound;
      else if (msg.includes('auth/too-many-requests')) msg = t.e_tooMany;
      else if (msg.includes('auth/user-disabled')) msg = t.e_disabled;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-6xl mb-6">📬</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.verifyTitle}</h2>
          <p className="text-gray-600 mb-2">{t.verifyCopy}</p>
          <p className="font-semibold text-brand-700 mb-6">{email}</p>
          <p className="text-gray-500 text-sm mb-8">{t.verifyInfo}</p>
          <button
            onClick={() => { setVerificationSent(false); setMode('login'); setPassword(''); setConfirmPassword(''); }}
            className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition-colors"
          >
            {t.btnAfterVerify}
          </button>
          <p className="text-xs text-gray-400 mt-4">{t.verifySpam}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-2xl font-bold text-gray-900 mb-2">MEafterMe</Link>
          <p className="text-gray-500 text-sm">
            {mode === 'login' ? t.tabLogin : t.tabRegister}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button type="button" onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.tabLogin}
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.tabRegister}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-body text-sm font-medium mb-1.5" style={{color:'hsl(38 50% 92% / 0.8)'}}>{t.labelEmail}</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder={t.placeholderEmail}
                className="w-full rounded-xl px-4 py-3 font-body text-base outline-none" style={{backgroundColor:'hsl(30 15% 7%)',border:'1px solid hsl(30 10% 18%)',color:'hsl(38 50% 92%)'}} />
            </div>

            <div>
              <label className="block font-body text-sm font-medium mb-1.5" style={{color:'hsl(38 50% 92% / 0.8)'}}>{t.labelPassword}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? t.placeholderPw : '••••••••'}
                  className="w-full rounded-xl px-4 py-3 font-body text-base outline-none pr-12" style={{backgroundColor:'hsl(30 15% 7%)',border:'1px solid hsl(30 10% 18%)',color:'hsl(38 50% 92%)'}} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg" tabIndex={-1}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {mode === 'register' && password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= pwScore ? pwStrengthColor : ''}`} style={{backgroundColor:i<=pwScore?undefined:'hsl(30 10% 18%)'}} />
                    ))}
                  </div>
                  <p className="font-body text-xs" style={{color:'hsl(38 50% 92% / 0.5)'}}>{t.strength} <span className="font-medium">{pwStrengthLabel}</span></p>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label className="block font-body text-sm font-medium mb-1.5" style={{color:'hsl(38 50% 92% / 0.8)'}}>{t.labelConfirm}</label>
                <input type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t.placeholderConfirm}
                  className="w-full rounded-xl px-4 py-3 font-body text-base outline-none" style={{backgroundColor:'hsl(30 15% 7%)',border:confirmPassword&&confirmPassword!==password?'1px solid hsl(0 70% 55%)':'1px solid hsl(30 10% 18%)',color:'hsl(38 50% 92%)'}} />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-500 mt-1">{t.err_match}</p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div className="rounded-xl p-3" style={{backgroundColor:'hsl(36 80% 55% / 0.08)',border:'1px solid hsl(36 80% 55% / 0.2)'}}>
                <p className="font-body text-xs font-medium mb-2" style={{color:'hsl(36 80% 55%)'}}>{t.req_title}</p>
                <ul className="space-y-1">
                  {t.req.map((text, i) => (
                    <li key={i} className="font-body text-xs flex items-center gap-1.5" style={{color:pwChecks[i]?'hsl(142 70% 55%)':'hsl(38 50% 92% / 0.5)'}}>
                      <span className="font-bold">{pwChecks[i] ? '✓' : '○'}</span> {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="rounded-xl px-4 py-3" style={{backgroundColor:'hsl(0 70% 40% / 0.1)',border:'1px solid hsl(0 70% 40% / 0.3)'}}>
                <p className="font-body text-sm" style={{color:'hsl(0 70% 65%)'}}>{ error}</p>
              </div>
            )}

            <button type="submit"
              disabled={loading || (mode === 'register' && confirmPassword !== '' && password !== confirmPassword)}
              className="w-full font-body font-bold py-3.5 rounded-full transition-all hover:scale-105 disabled:opacity-60 text-base mt-2" style={{backgroundColor:'hsl(36 80% 55%)',color:'hsl(30 15% 7%)'}}>
              {loading ? '…' : mode === 'login' ? t.btnLogin : t.btnRegister}
            </button>
          </form>

          <div className="mt-5 text-center font-body text-sm" style={{color:'hsl(38 50% 92% / 0.5)'}}>
            {mode === 'login' ? (
              <>{t.noAccount}{' '}
                <button onClick={() => { setMode('register'); setError(''); }} className="font-medium hover:underline" style={{color:'hsl(36 80% 55%)'}}>{t.registerLink}</button>
              </>
            ) : (
              <>{t.haveAccount}{' '}
                <button onClick={() => { setMode('login'); setError(''); }} className="font-medium hover:underline" style={{color:'hsl(36 80% 55%)'}}>{t.loginLink}</button>
              </>
            )}
          </div>
        </div>
        <p className="font-body text-center text-sm mt-6">
          <Link href="/" className="hover:underline" style={{color:'hsl(38 50% 92% / 0.4)'}}>{t.backHome}</Link>
        </p>
      </div>
    </div>
  );
}
