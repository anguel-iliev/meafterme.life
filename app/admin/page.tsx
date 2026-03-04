'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllUsers, getWaitlistSignups, getInviteCodes, createInviteCode, adminApproveUser
} from '@/lib/clientStore';

interface User { uid: string; email: string; status: string; }
interface InviteCode { code: string; used: boolean; usedByEmail?: string; }

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'pending' | 'users' | 'codes' | 'waitlist'>('pending');

  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [waitlist, setWaitlist] = useState<{ email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [newCode, setNewCode] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, users, inviteCodes, wlist] = await Promise.all([
        getAllUsers(),
        getAllUsers(),
        getInviteCodes(),
        getWaitlistSignups(),
      ]);
      setPendingUsers(pending.filter(u => u.status === 'PENDING_APPROVAL'));
      setAllUsers(users);
      setCodes(inviteCodes);
      setWaitlist(wlist);
    } catch (err) {
      setMsg('Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    // In demo mode, any secret works. In production, check against ADMIN_SECRET
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || 'admin';
    if (secret === adminSecret || secret.length >= 4) {
      setAuthed(true);
      loadData();
    } else {
      setMsg('Invalid admin secret');
    }
  }

  async function approveUser(uid: string) {
    setMsg('');
    try {
      await adminApproveUser(uid, secret);
      setMsg('✅ User approved!');
      await loadData();
    } catch {
      setMsg('Error approving user');
    }
  }

  async function generateCode() {
    setMsg('');
    try {
      const code = await createInviteCode(newCode || undefined);
      setMsg(`✅ Code created: ${code}`);
      setNewCode('');
      await loadData();
    } catch {
      setMsg('Error creating code');
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Admin Panel</h1>
          <p className="text-gray-500 text-sm text-center mb-6">MEafterMe Administration</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Admin secret"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {msg && <p className="text-red-500 text-sm">{msg}</p>}
            <button
              type="submit"
              className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition-colors"
            >
              Enter Admin Panel
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-4">Demo: enter any 4+ character secret</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Users', value: allUsers.length, color: 'bg-blue-50 text-blue-700' },
    { label: 'Pending Approval', value: pendingUsers.length, color: 'bg-amber-50 text-amber-700' },
    { label: 'Active Users', value: allUsers.filter(u => u.status === 'ACTIVE').length, color: 'bg-green-50 text-green-700' },
    { label: 'Waitlist', value: waitlist.length, color: 'bg-purple-50 text-purple-700' },
  ];

  const statusColor: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
    WAITLISTED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">MEafterMe Admin</h1>
          <p className="text-xs text-gray-500">Administration Panel</p>
        </div>
        <button onClick={() => setAuthed(false)} className="text-sm text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map(s => (
            <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
              <div className="text-3xl font-bold">{s.value}</div>
              <div className="text-sm font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {msg && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">{msg}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(['pending', 'users', 'codes', 'waitlist'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'pending' ? `Pending (${pendingUsers.length})` :
               t === 'users' ? `All Users (${allUsers.length})` :
               t === 'codes' ? `Invite Codes (${codes.length})` :
               `Waitlist (${waitlist.length})`}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-500 text-sm">Loading...</p>}

        {/* Pending tab */}
        {tab === 'pending' && (
          <div className="space-y-3">
            {pendingUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">✅</div>
                <p>No pending approvals</p>
              </div>
            ) : pendingUsers.map(u => (
              <div key={u.uid} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center">
                    {u.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{u.email}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[u.status] || 'bg-gray-100 text-gray-600'}`}>
                      {u.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => approveUser(u.uid)}
                  className="bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors"
                >
                  ✓ Approve
                </button>
              </div>
            ))}
          </div>
        )}

        {/* All Users tab */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allUsers.map(u => (
                  <tr key={u.uid}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center">
                          {u.email[0].toUpperCase()}
                        </div>
                        <span className="text-gray-800">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[u.status] || 'bg-gray-100 text-gray-600'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.status !== 'ACTIVE' && (
                        <button
                          onClick={() => approveUser(u.uid)}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                        >
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

        {/* Invite Codes tab */}
        {tab === 'codes' && (
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex gap-3">
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase())}
                placeholder="Custom code (optional)"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-400"
                maxLength={12}
              />
              <button
                onClick={generateCode}
                className="bg-brand-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-brand-700 transition-colors text-sm"
              >
                + Generate Code
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Used By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {codes.map(c => (
                    <tr key={c.code}>
                      <td className="px-4 py-3 font-mono font-bold text-brand-700">{c.code}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.used ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {c.used ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.usedByEmail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Waitlist tab */}
        {tab === 'waitlist' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {waitlist.map((w, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-800">{w.email}</td>
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
