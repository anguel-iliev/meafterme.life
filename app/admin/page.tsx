'use client';
import React, { useState, useEffect, useCallback } from 'react';

interface User {
  uid: string;
  email: string;
  status: string;
  createdAt: any;
}
interface InviteCode {
  id: string;
  code: string;
  used: boolean;
  usedByEmail?: string;
  createdAt: any;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'pending' | 'users' | 'codes' | 'waitlist'>('pending');

  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-admin-secret': secret,
  }), [secret]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/users?filter=pending', { headers: { 'x-admin-secret': secret } });
    setLoading(false);
    if (res.ok) {
      setAuthed(true);
      loadData();
    } else {
      setMsg('Invalid admin secret');
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, c, w] = await Promise.all([
        fetch('/api/admin/users?filter=pending', { headers: { 'x-admin-secret': secret } }).then(r => r.json()),
        fetch('/api/admin/users', { headers: { 'x-admin-secret': secret } }).then(r => r.json()),
        fetch('/api/admin/generate-code', { headers: { 'x-admin-secret': secret } }).then(r => r.json()),
        fetch('/api/admin/waitlist', { headers: { 'x-admin-secret': secret } }).then(r => r.json()),
      ]);
      setPendingUsers(p.users || []);
      setAllUsers(a.users || []);
      setCodes(c.codes || []);
      setWaitlist(w.signups || []);
    } finally {
      setLoading(false);
    }
  }, [secret]);

  async function approveUser(uid: string) {
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ uid }),
    });
    setMsg(`Approved ${uid}`);
    loadData();
  }

  async function generateCode() {
    const res = await fetch('/api/admin/generate-code', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setMsg(`Generated: ${data.code}`);
    loadData();
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 w-full max-w-sm shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-6 text-center">Admin Login</h1>
          <form onSubmit={login} className="space-y-4">
            <input
              type="password"
              required
              placeholder="Admin secret"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {msg && <p className="text-red-500 text-sm">{msg}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60">
              {loading ? '…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'pending', label: `Pending (${pendingUsers.length})` },
    { key: 'users',   label: `All Users (${allUsers.length})` },
    { key: 'codes',   label: `Invite Codes (${codes.length})` },
    { key: 'waitlist',label: `Waitlist (${waitlist.length})` },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">MEafterMe Admin</h1>
        <div className="flex items-center gap-4">
          {msg && <span className="text-green-600 text-sm font-medium">{msg}</span>}
          <button onClick={loadData} className="text-sm text-brand-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.key ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={generateCode}
            className="ml-auto px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            + Generate Invite Code
          </button>
        </div>

        {loading && <div className="text-gray-400 text-sm mb-4">Loading…</div>}

        {/* Pending users */}
        {tab === 'pending' && (
          <div className="space-y-3">
            {pendingUsers.length === 0 && <p className="text-gray-400 text-sm">No pending users.</p>}
            {pendingUsers.map(u => (
              <div key={u.uid} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{u.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">UID: {u.uid}</p>
                </div>
                <button
                  onClick={() => approveUser(u.uid)}
                  className="bg-green-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}

        {/* All users */}
        {tab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">UID</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <tr key={u.uid} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                        u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        u.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{u.uid.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      {u.status === 'PENDING_APPROVAL' && (
                        <button onClick={() => approveUser(u.uid)}
                          className="text-xs font-bold text-green-600 hover:underline">
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invite codes */}
        {tab === 'codes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Code</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Used by</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 tracking-widest">{c.code}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        c.used ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                      }`}>
                        {c.used ? 'Used' : 'Available'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.usedByEmail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Waitlist */}
        {tab === 'waitlist' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Early Access</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((w: any) => (
                  <tr key={w.id} className="border-b border-gray-100">
                    <td className="px-4 py-3">{w.email}</td>
                    <td className="px-4 py-3 text-xs">{w.earlyAccess ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
