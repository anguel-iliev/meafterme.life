'use client';
import React, { useState } from 'react';
import type { SessionUser } from '@/lib/session';
import { en } from '@/dictionaries/en';
import Link from 'next/link';

const STARTER_100_CATEGORIES = [
  { name: 'Origins & Family', icon: '🌳', count: 15 },
  { name: 'Childhood', icon: '🧒', count: 15 },
  { name: 'Education & Career', icon: '📚', count: 15 },
  { name: 'Values & Beliefs', icon: '💡', count: 15 },
  { name: 'Relationships', icon: '❤️', count: 15 },
  { name: 'Life lessons', icon: '🌿', count: 15 },
  { name: 'Messages to the future', icon: '✉️', count: 10 },
];

export default function AppDashboard({ user }: { user: SessionUser }) {
  const dict = en; // default, client can switch
  const d = dict.app;
  const [hasProfile] = useState(false); // TODO: load from API

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{d.dashboardTitle}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
            {d.status.ACTIVE}
          </span>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-800 font-medium">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!hasProfile ? (
          /* No profile yet — wizard CTA */
          <div className="text-center bg-white border border-gray-200 rounded-2xl p-14 shadow-sm">
            <div className="text-5xl mb-5">🎙️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{d.noProfile}</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-md mx-auto">
              Start your legacy journey — create a profile, upload consent, and begin recording with Starter 100.
            </p>
            <Link
              href="/app/create-profile"
              className="inline-block bg-brand-600 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-brand-700 transition-colors"
            >
              {d.createProfileCta}
            </Link>
          </div>
        ) : (
          /* Has profile — recording progress */
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Legacy Profile</h2>
                <span className="text-sm text-gray-500">{d.progress.replace('{done}', '0').replace('{total}', '100')}</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
                <div className="bg-brand-600 h-2 rounded-full" style={{ width: '0%' }} />
              </div>
              <button className="bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-brand-700 transition-colors">
                {d.continueRecording}
              </button>
            </div>

            {/* Categories */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STARTER_100_CATEGORIES.map(cat => (
                <div key={cat.name} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="text-3xl">{cat.icon}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{cat.name}</p>
                    <p className="text-xs text-gray-400">{cat.count} questions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
